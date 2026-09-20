"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconoComentar, IconoEnviar, IconoBasura, IconoEditar, IconoRespuesta, IconoCheck, IconoCerrar, IconoCargando } from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { formatDistanceToNow } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";

export interface CommentAuthor {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
}

export interface CommentItem {
  id: string;
  cause_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author: CommentAuthor;
  replies_count: number;
}

interface CommentsSectionProps {
  causeId: string;
  causeAuthorId: string;
  initialComments?: CommentItem[];
  thread?: "causa" | "resultado";
  currentUser?: { id: string; email: string } | null;
  currentUserProfile?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url?: string | null;
    onboarding_completed_at?: string | null;
  } | null;
}

export function CommentsSection({
  causeId,
  causeAuthorId,
  initialComments = [],
  thread = "causa",
  currentUser,
  currentUserProfile,
}: CommentsSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const isOnboarded = Boolean(currentUser && currentUserProfile?.onboarding_completed_at);

  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [repliesMap, setRepliesMap] = useState<Record<string, CommentItem[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // New comment input
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  // Fetch root comments if not provided
  useEffect(() => {
    async function loadRootComments() {
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          id,
          cause_id,
          parent_id,
          body,
          created_at,
          edited_at,
          author_id,
          replies_count,
          author:profiles!comments_author_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          )
        `
        )
        .eq("cause_id", causeId)
        .eq("thread", thread)
        .is("parent_id", null)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setComments(data as any);
      }
    }

    if (initialComments.length === 0) {
      loadRootComments();
    }
  }, [causeId, thread, initialComments.length]);

  // Load replies for a root comment
  const toggleReplies = async (rootCommentId: string) => {
    if (expandedReplies.has(rootCommentId)) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.delete(rootCommentId);
        return next;
      });
      return;
    }

    // Load from DB if not already loaded
    if (!repliesMap[rootCommentId]) {
      setLoadingReplies((prev) => new Set(prev).add(rootCommentId));
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          id,
          cause_id,
          parent_id,
          body,
          created_at,
          edited_at,
          author_id,
          replies_count,
          author:profiles!comments_author_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          )
        `
        )
        .eq("cause_id", causeId)
        .eq("parent_id", rootCommentId)
        .order("created_at", { ascending: true });

      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(rootCommentId);
        return next;
      });

      if (!error && data) {
        setRepliesMap((prev) => ({ ...prev, [rootCommentId]: data as any }));
      }
    }

    setExpandedReplies((prev) => new Set(prev).add(rootCommentId));
  };

  // Submit new comment or reply
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push(`/entrar?next=/causa/${causeId}#comentarios`);
      return;
    }
    if (!isOnboarded) {
      router.push("/bienvenida");
      return;
    }
    const trimmed = newCommentBody.trim();
    if (!trimmed || trimmed.length > 1000) return;

    setIsSubmitting(true);
    try {
      const { data: created, error } = await supabase
        .from("comments")
        .insert({
          cause_id: causeId,
          author_id: currentUser.id,
          body: trimmed,
          parent_id: replyTo ? replyTo.id : null,
          thread,
        })
        .select(
          `
          id,
          cause_id,
          parent_id,
          body,
          created_at,
          edited_at,
          author_id,
          replies_count,
          author:profiles!comments_author_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          )
        `
        )
        .single();

      if (error) throw error;

      const item = created as any as CommentItem;

      if (replyTo) {
        // Find which root comment this belongs to
        const rootId = replyTo.parent_id || replyTo.id;
        setRepliesMap((prev) => ({
          ...prev,
          [rootId]: [...(prev[rootId] || []), item],
        }));
        setExpandedReplies((prev) => new Set(prev).add(rootId));
        // Increment replies_count on root comment
        setComments((prev) =>
          prev.map((c) => (c.id === rootId ? { ...c, replies_count: c.replies_count + 1 } : c))
        );
      } else {
        // Add root comment to top
        setComments((prev) => [item, ...prev]);
      }

      setNewCommentBody("");
      setReplyTo(null);
    } catch (err: any) {
      alert("Error al publicar comentario: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (comment: CommentItem) => {
    if (!confirm("¿Seguro que deseas eliminar este comentario?")) return;

    const isRoot = !comment.parent_id;
    await supabase.from("comments").delete().eq("id", comment.id);

    if (isRoot) {
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setRepliesMap((prev) => {
        const copy = { ...prev };
        delete copy[comment.id];
        return copy;
      });
    } else {
      const rootId = comment.parent_id!;
      setRepliesMap((prev) => ({
        ...prev,
        [rootId]: (prev[rootId] || []).filter((r) => r.id !== comment.id),
      }));
      setComments((prev) =>
        prev.map((c) =>
          c.id === rootId ? { ...c, replies_count: Math.max(0, c.replies_count - 1) } : c
        )
      );
    }
  };

  // Edit comment
  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editingBody.trim();
    if (!trimmed) return;

    await supabase
      .from("comments")
      .update({ body: trimmed, edited_at: new Date().toISOString() })
      .eq("id", commentId);

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, body: trimmed, edited_at: new Date().toISOString() } : c
      )
    );

    // Also update in replies if applicable
    setRepliesMap((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        updated[key] = updated[key].map((r) =>
          r.id === commentId ? { ...r, body: trimmed, edited_at: new Date().toISOString() } : r
        );
      });
      return updated;
    });

    setEditingCommentId(null);
    setEditingBody("");
  };

  return (
    <section id="comentarios" className="space-y-6 pt-6">
      <div className="flex items-center gap-2">
        <IconoComentar size={20} className="text-accent" />
        <h3 className="font-bold text-lg text-text-primary">
          Comentarios {comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Input box */}
      {!currentUser ? (
        <div className="p-4 rounded-2xl glass-surface border border-glass-tint text-center text-xs text-text-secondary">
          <Link href={`/entrar?next=/causa/${causeId}#comentarios`} className="text-accent underline font-semibold">
            Inicia sesión con Google
          </Link>{" "}
          para dejar un comentario o mensaje de apoyo.
        </div>
      ) : !isOnboarded ? (
        <div className="p-4 rounded-2xl glass-surface border border-glass-tint text-center text-xs text-text-secondary space-y-2">
          <p>Completa tu nombre de usuario para poder comentar en las causas.</p>
          <Link
            href="/bienvenida"
            className="inline-block px-4 py-1.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-all cursor-pointer"
          >
            Completar perfil
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmitComment} className="glass-card rounded-2xl p-4 space-y-3">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-text-secondary bg-glass-surface px-3 py-1.5 rounded-xl border border-glass-tint">
              <span>
                Respondiendo a <strong className="text-text-primary">@{replyTo.author.username}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <IconoCerrar size={14} />
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <textarea
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={
                replyTo
                  ? `Responde a @${replyTo.author.username}...`
                  : "Escribe un mensaje de apoyo o consulta..."
              }
              className="flex-1 bg-transparent border-none outline-none text-text-primary text-sm placeholder:text-text-secondary resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCommentBody.trim()}
              className="self-end p-2.5 rounded-full bg-accent text-white disabled:opacity-30 hover:bg-accent/90 transition-transform active:scale-95 cursor-pointer"
              aria-label="Publicar comentario"
            >
              {isSubmitting ? <IconoCargando size={16} className="animate-spin" /> : <IconoEnviar size={16} />}
            </button>
          </div>

          <div className="flex justify-between items-center text-[11px] text-text-secondary">
            <span>Sé respetuoso y solidario</span>
            <span>{newCommentBody.length} / 1000</span>
          </div>
        </form>
      )}

      {/* Comments stream */}
      <div className="space-y-4">
        {comments.map((comment) => {
          const isAuthor = currentUser?.id === comment.author_id;
          const isCauseOwner = currentUser?.id === causeAuthorId;
          const canDelete = isAuthor || isCauseOwner;
          const canEdit = isAuthor;
          const replies = repliesMap[comment.id] || [];
          const isExpanded = expandedReplies.has(comment.id);
          const isLoadingThisReplies = loadingReplies.has(comment.id);

          return (
            <div key={comment.id} className="glass-surface p-4 rounded-2xl space-y-2 border border-glass-tint">
              {/* Comment Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/u/${comment.author.username}`}
                    className="w-7 h-7 rounded-full bg-glass-tint flex items-center justify-center text-xs font-bold text-accent overflow-hidden"
                  >
                    {comment.author.avatar_url ? (
                      <img src={comment.author.avatar_url} alt={comment.author.full_name} className="w-full h-full object-cover" />
                    ) : (
                      comment.author.full_name.charAt(0).toUpperCase()
                    )}
                  </Link>

                  <div className="flex items-center gap-1.5 text-xs">
                    <Link href={`/u/${comment.author.username}`} className="font-semibold text-text-primary hover:underline">
                      {comment.author.full_name}
                    </Link>
                    <span className="text-text-secondary">@{comment.author.username}</span>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary">{formatDistanceToNow(comment.created_at)}</span>
                    {comment.edited_at && <span className="text-[10px] text-text-secondary italic">(editado)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-text-secondary">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingBody(comment.body);
                      }}
                      className="p-1 hover:text-text-primary"
                      title="Editar"
                    >
                      <IconoEditar size={12} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteComment(comment)}
                      className="p-1 hover:text-red-400"
                      title="Eliminar"
                    >
                      <IconoBasura size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Body */}
              {editingCommentId === comment.id ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl glass-tint border border-glass-tint text-xs text-text-primary outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingCommentId(null)}
                      className="px-3 py-1 rounded-lg text-[11px] glass-surface text-text-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      className="px-3 py-1 rounded-lg text-[11px] bg-accent text-white font-semibold"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-primary whitespace-pre-wrap pl-9">{comment.body}</p>
              )}

              {/* Footer: Reply button and Toggle Replies */}
              <div className="pl-9 flex items-center gap-4 text-xs">
                {isOnboarded ? (
                  <button
                    onClick={() => {
                      setReplyTo(comment);
                      setNewCommentBody(`@${comment.author.username} `);
                    }}
                    className="text-text-secondary hover:text-accent font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <IconoRespuesta size={12} /> Responder
                  </button>
                ) : currentUser ? (
                  <Link
                    href="/bienvenida"
                    className="text-text-secondary hover:text-accent font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <IconoRespuesta size={12} /> Responder
                  </Link>
                ) : null}

                {comment.replies_count > 0 && (
                  <button
                    onClick={() => toggleReplies(comment.id)}
                    className="text-accent hover:underline font-medium"
                  >
                    {isExpanded
                      ? "Ocultar respuestas"
                      : `Ver ${comment.replies_count} ${comment.replies_count === 1 ? "respuesta" : "respuestas"}`}
                  </button>
                )}

                {isLoadingThisReplies && <IconoCargando size={12} className="animate-spin text-accent" />}
              </div>

              {/* Collapsed/Expanded 1-level replies stream */}
              {isExpanded && replies.length > 0 && (
                <div className="pl-9 pt-2 space-y-3 border-l-2 border-glass-tint ml-3">
                  {replies.map((reply) => {
                    const isReplyAuthor = currentUser?.id === reply.author_id;
                    const canDeleteReply = isReplyAuthor || isCauseOwner;

                    return (
                      <div key={reply.id} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/u/${reply.author.username}`}
                              className="w-5 h-5 rounded-full bg-glass-tint flex items-center justify-center font-bold text-[10px] text-accent overflow-hidden"
                            >
                              {reply.author.avatar_url ? (
                                <img src={reply.author.avatar_url} alt={reply.author.full_name} className="w-full h-full object-cover" />
                              ) : (
                                reply.author.full_name.charAt(0).toUpperCase()
                              )}
                            </Link>
                            <Link href={`/u/${reply.author.username}`} className="font-semibold text-text-primary hover:underline">
                              {reply.author.full_name}
                            </Link>
                            <span className="text-text-secondary">@{reply.author.username}</span>
                            <span className="text-text-secondary">•</span>
                            <span className="text-text-secondary">{formatDistanceToNow(reply.created_at)}</span>
                            {reply.edited_at && <span className="text-[10px] text-text-secondary italic">(editado)</span>}
                          </div>

                          <div className="flex items-center gap-1 text-text-secondary">
                            {isReplyAuthor && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(reply.id);
                                  setEditingBody(reply.body);
                                }}
                                className="p-1 hover:text-text-primary"
                                title="Editar"
                              >
                                <IconoEditar size={11} />
                              </button>
                            )}
                            {canDeleteReply && (
                              <button
                                onClick={() => handleDeleteComment(reply)}
                                className="p-1 hover:text-red-400"
                                title="Eliminar"
                              >
                                <IconoBasura size={11} />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingCommentId === reply.id ? (
                          <div className="space-y-2 pt-1 pl-7">
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-1.5 rounded-xl glass-tint border border-glass-tint text-xs text-text-primary outline-none resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="px-2 py-0.5 rounded text-[10px] glass-surface text-text-secondary"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleSaveEdit(reply.id)}
                                className="px-2 py-0.5 rounded text-[10px] bg-accent text-white font-semibold"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-text-primary whitespace-pre-wrap pl-7">{reply.body}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-xs text-text-secondary text-center py-4">
            Aún no hay comentarios. Sé la primera persona en dejar un mensaje.
          </p>
        )}
      </div>
    </section>
  );
}
