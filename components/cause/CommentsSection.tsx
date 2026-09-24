"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconoComentar, IconoEnviar, IconoBasura, IconoEditar, IconoRespuesta, IconoCerrar, IconoCargando } from "@/components/iconos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { urlDeAvatar } from "@/lib/media";
import {
  cargarComentariosAction,
  cargarRespuestasAction,
  createCommentAction,
  deleteCommentAction,
  editCommentAction,
} from "@/app/actions/comments";

export interface CommentAuthor {
  id: string;
  full_name: string;
  public_id: string;
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
  initialComments: CommentItem[];
  initialHasMore: boolean;
  initialTotal: number;
  thread?: "causa" | "resultado";
  currentUser?: { id: string; email: string } | null;
  currentUserProfile?: {
    id: string;
    full_name: string | null;
    public_id: string | null;
    avatar_url?: string | null;
    onboarding_completed_at?: string | null;
  } | null;
}

function Avatar({ author, className }: { author: CommentAuthor; className: string }) {
  const src = urlDeAvatar(author.avatar_url);
  return (
    <Link href={`/u/${author.public_id}`} className={className}>
      {src ? (
        <img src={src} alt={author.full_name} className="w-full h-full object-cover" />
      ) : (
        author.full_name.charAt(0).toUpperCase()
      )}
    </Link>
  );
}

export function CommentsSection({
  causeId,
  causeAuthorId,
  initialComments,
  initialHasMore,
  initialTotal,
  thread = "causa",
  currentUser,
  currentUserProfile,
}: CommentsSectionProps) {
  const router = useRouter();
  const isOnboarded = Boolean(currentUser && currentUserProfile?.onboarding_completed_at);
  const loginHref = `/entrar?next=${encodeURIComponent(`/causa/${causeId}#comentarios`)}`;

  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [repliesMap, setRepliesMap] = useState<Record<string, CommentItem[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  const [repliesError, setRepliesError] = useState<Record<string, string>>({});

  // New comment input
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const handleLoadMore = async () => {
    const last = comments.filter((c) => !c.id.startsWith("temp-")).at(-1);
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await cargarComentariosAction(causeId, thread, last?.created_at);
      if (!res.success) {
        setLoadMoreError(res.error);
        return;
      }
      const nuevos = res.comments as unknown as CommentItem[];
      setComments((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...nuevos.filter((c) => !ids.has(c.id))];
      });
      setHasMore(res.hasMore);
    } catch (err: any) {
      console.error("Ver más comentarios:", err?.code, err?.message);
      setLoadMoreError(`No pudimos cargar más comentarios: ${err?.message || "error desconocido"}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadReplies = async (rootCommentId: string) => {
    setLoadingReplies((prev) => new Set(prev).add(rootCommentId));
    setRepliesError((prev) => {
      const next = { ...prev };
      delete next[rootCommentId];
      return next;
    });
    try {
      const res = await cargarRespuestasAction(causeId, rootCommentId);
      if (!res.success) {
        setRepliesError((prev) => ({ ...prev, [rootCommentId]: res.error }));
        return;
      }
      setRepliesMap((prev) => ({ ...prev, [rootCommentId]: res.replies as unknown as CommentItem[] }));
      setExpandedReplies((prev) => new Set(prev).add(rootCommentId));
    } catch (err: any) {
      console.error("Cargar respuestas:", err?.code, err?.message);
      setRepliesError((prev) => ({
        ...prev,
        [rootCommentId]: `No pudimos cargar las respuestas: ${err?.message || "error desconocido"}`,
      }));
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(rootCommentId);
        return next;
      });
    }
  };

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

    if (!repliesMap[rootCommentId]) {
      await loadReplies(rootCommentId);
      return;
    }

    setExpandedReplies((prev) => new Set(prev).add(rootCommentId));
  };

  const startReply = (target: CommentItem) => {
    setReplyTo(target);
    setSubmitError(null);
    // Responder a una respuesta cuelga del raíz y antepone el nombre de la persona
    setNewCommentBody(target.parent_id ? `${target.author.full_name}, ` : "");
    document.getElementById("comentarios")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Submit new comment or reply (optimista: aparece de inmediato y se revierte si falla)
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      router.push(loginHref);
      return;
    }
    if (!isOnboarded) {
      router.push("/bienvenida");
      return;
    }
    const trimmed = newCommentBody.trim();
    if (!trimmed || trimmed.length > 1000) return;

    const rootId = replyTo ? replyTo.parent_id || replyTo.id : null;
    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentItem = {
      id: tempId,
      cause_id: causeId,
      parent_id: rootId,
      body: trimmed,
      created_at: new Date().toISOString(),
      edited_at: null,
      author_id: currentUser.id,
      author: {
        id: currentUser.id,
        full_name: currentUserProfile?.full_name || "Tú",
        public_id: currentUserProfile?.public_id || "",
        avatar_url: currentUserProfile?.avatar_url,
      },
      replies_count: 0,
    };

    const previousBody = newCommentBody;
    const previousReplyTo = replyTo;

    if (rootId) {
      setRepliesMap((prev) => ({ ...prev, [rootId]: [...(prev[rootId] || []), optimistic] }));
      setExpandedReplies((prev) => new Set(prev).add(rootId));
      setComments((prev) =>
        prev.map((c) => (c.id === rootId ? { ...c, replies_count: c.replies_count + 1 } : c))
      );
    } else {
      setComments((prev) => [optimistic, ...prev]);
    }
    setTotal((t) => t + 1);
    setNewCommentBody("");
    setReplyTo(null);
    setSubmitError(null);
    setIsSubmitting(true);

    const revert = (message: string) => {
      if (rootId) {
        setRepliesMap((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).filter((c) => c.id !== tempId),
        }));
        setComments((prev) =>
          prev.map((c) =>
            c.id === rootId ? { ...c, replies_count: Math.max(0, c.replies_count - 1) } : c
          )
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
      }
      setTotal((t) => Math.max(0, t - 1));
      setNewCommentBody(previousBody);
      setReplyTo(previousReplyTo);
      setSubmitError(message);
    };

    try {
      const res = await createCommentAction({
        causeId,
        body: trimmed,
        parentId: previousReplyTo ? previousReplyTo.id : null,
        thread,
      });

      if (!res.success || !res.comment) {
        revert(res.error || "No pudimos publicar el comentario.");
        if (res.redirect) router.push(res.redirect);
        return;
      }

      const item = res.comment as unknown as CommentItem;
      if (rootId) {
        setRepliesMap((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).map((c) => (c.id === tempId ? item : c)),
        }));
      } else {
        setComments((prev) => prev.map((c) => (c.id === tempId ? item : c)));
      }
    } catch (err: any) {
      console.error("Publicar comentario:", err?.code, err?.message);
      revert(`No pudimos publicar el comentario: ${err?.message || "error desconocido"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (comment: CommentItem) => {
    if (!confirm("¿Seguro que deseas eliminar este comentario?")) return;

    const isRoot = !comment.parent_id;
    try {
      const res = await deleteCommentAction(comment.id, causeId);
      if (!res.success) {
        alert(res.error || "No pudimos eliminar el comentario.");
        return;
      }

      if (isRoot) {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
        setRepliesMap((prev) => {
          const copy = { ...prev };
          delete copy[comment.id];
          return copy;
        });
        // Al borrar un raíz también se borran sus respuestas
        setTotal((t) => Math.max(0, t - 1 - comment.replies_count));
      } else {
        const rootId = comment.parent_id!;
        setRepliesMap((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).filter((c) => c.id !== comment.id),
        }));
        setComments((prev) =>
          prev.map((c) =>
            c.id === rootId ? { ...c, replies_count: Math.max(0, c.replies_count - 1) } : c
          )
        );
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch (err: any) {
      console.error("Eliminar comentario:", err?.code, err?.message);
      alert(`No pudimos eliminar el comentario: ${err?.message || "error desconocido"}`);
    }
  };

  // Edit comment
  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editingBody.trim();
    if (!trimmed) return;

    try {
      const res = await editCommentAction(commentId, causeId, trimmed);
      if (!res.success) {
        alert(res.error || "No pudimos guardar el cambio.");
        return;
      }
      const editedAt = res.editedAt || new Date().toISOString();

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, body: trimmed, edited_at: editedAt } : c))
      );
      setRepliesMap((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          updated[key] = updated[key].map((r) =>
            r.id === commentId ? { ...r, body: trimmed, edited_at: editedAt } : r
          );
        });
        return updated;
      });

      setEditingCommentId(null);
      setEditingBody("");
    } catch (err: any) {
      console.error("Editar comentario:", err?.code, err?.message);
      alert(`No pudimos guardar el cambio: ${err?.message || "error desconocido"}`);
    }
  };

  const renderReplyButton = (target: CommentItem) =>
    target.id.startsWith("temp-") ? null : isOnboarded ? (
      <button
        onClick={() => startReply(target)}
        className="text-text-secondary hover:text-accent font-medium flex items-center gap-1 cursor-pointer"
      >
        <IconoRespuesta size={12} /> Responder
      </button>
    ) : (
      <Link
        href={currentUser ? "/bienvenida" : loginHref}
        className="text-text-secondary hover:text-accent font-medium flex items-center gap-1 cursor-pointer"
      >
        <IconoRespuesta size={12} /> Responder
      </Link>
    );

  return (
    <section className="space-y-6 pt-6">
      <div className="flex items-center gap-2">
        <IconoComentar size={20} className="text-accent" />
        <h3 className="font-bold text-lg text-text-primary">
          Comentarios ({total})
        </h3>
      </div>

      {/* Input box */}
      {!currentUser ? (
        <div className="p-4 rounded-2xl glass-surface border border-glass-tint text-center text-xs text-text-secondary">
          <Link href={loginHref} className="text-accent underline font-semibold">
            Inicia sesión
          </Link>{" "}
          para dejar un comentario o mensaje de apoyo.
        </div>
      ) : !isOnboarded ? (
        <div className="p-4 rounded-2xl glass-surface border border-glass-tint text-center text-xs text-text-secondary space-y-2">
          <p>Completa tu registro para poder comentar en las causas.</p>
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
                Respondiendo a <strong className="text-text-primary">{replyTo.author.full_name}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setNewCommentBody("");
                }}
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
                  ? `Responde a ${replyTo.author.full_name}...`
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

          {submitError && <p className="text-xs text-red-400">{submitError}</p>}

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
          const isTemp = comment.id.startsWith("temp-");
          const canDelete = (isAuthor || isCauseOwner) && !isTemp;
          const canEdit = isAuthor && !isTemp;
          const replies = repliesMap[comment.id] || [];
          const isExpanded = expandedReplies.has(comment.id);
          const isLoadingThisReplies = loadingReplies.has(comment.id);
          const thisRepliesError = repliesError[comment.id];

          return (
            <div key={comment.id} className="glass-surface p-4 rounded-2xl space-y-2 border border-glass-tint">
              {/* Comment Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar
                    author={comment.author}
                    className="w-7 h-7 rounded-full bg-glass-tint flex items-center justify-center text-xs font-bold text-accent overflow-hidden"
                  />

                  <div className="flex items-center gap-1.5 text-xs">
                    <Link href={`/u/${comment.author.public_id}`} className="font-semibold text-text-primary hover:underline">
                      {comment.author.full_name}
                    </Link>
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
                {renderReplyButton(comment)}

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

              {thisRepliesError && (
                <div className="pl-9 flex items-center gap-2 text-xs text-red-400">
                  <span>{thisRepliesError}</span>
                  <button
                    onClick={() => loadReplies(comment.id)}
                    className="text-accent hover:underline font-medium"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Collapsed/Expanded 1-level replies stream */}
              {isExpanded && replies.length > 0 && (
                <div className="pl-9 pt-2 space-y-3 border-l-2 border-glass-tint ml-3">
                  {replies.map((reply) => {
                    const isReplyAuthor = currentUser?.id === reply.author_id;
                    const isReplyTemp = reply.id.startsWith("temp-");
                    const canDeleteReply = (isReplyAuthor || isCauseOwner) && !isReplyTemp;

                    return (
                      <div key={reply.id} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar
                              author={reply.author}
                              className="w-5 h-5 rounded-full bg-glass-tint flex items-center justify-center font-bold text-[10px] text-accent overflow-hidden"
                            />
                            <Link href={`/u/${reply.author.public_id}`} className="font-semibold text-text-primary hover:underline">
                              {reply.author.full_name}
                            </Link>
                            <span className="text-text-secondary">•</span>
                            <span className="text-text-secondary">{formatDistanceToNow(reply.created_at)}</span>
                            {reply.edited_at && <span className="text-[10px] text-text-secondary italic">(editado)</span>}
                          </div>

                          <div className="flex items-center gap-1 text-text-secondary">
                            {isReplyAuthor && !isReplyTemp && (
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

                        <div className="pl-7 flex items-center gap-4 text-xs">
                          {renderReplyButton(reply)}
                        </div>
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

        {(hasMore || loadMoreError) && (
          <div className="flex flex-col items-center gap-1 text-xs">
            {loadMoreError && <span className="text-red-400">{loadMoreError}</span>}
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-accent hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {loadingMore && <IconoCargando size={12} className="animate-spin" />}
              {loadMoreError ? "Reintentar" : "Ver más"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
