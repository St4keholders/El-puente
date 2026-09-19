export interface TopoData {
  type: string;
  transform: {
    scale: [number, number];
    translate: [number, number];
  };
  objects: {
    countries: {
      type: string;
      geometries: Array<{
        type: 'Polygon' | 'MultiPolygon';
        id: string;
        arcs: any[];
      }>;
    };
  };
  arcs: number[][][];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  properties: Record<string, any>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

export function decodeTopo(topo: TopoData): GeoJsonFeature[] {
  const [kx, ky] = topo.transform.scale;
  const [dx, dy] = topo.transform.translate;

  const arcs: [number, number][][] = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((p) => {
      x += p[0];
      y += p[1];
      return [x * kx + dx, y * ky + dy];
    });
  });

  function ring(idxs: number[]): [number, number][] {
    const pts: [number, number][] = [];
    idxs.forEach((i) => {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      if (pts.length) pts.pop();
      for (let j = 0; j < a.length; j++) pts.push(a[j]);
    });
    return pts;
  }

  return topo.objects.countries.geometries.map((g) => ({
    type: 'Feature',
    id: g.id,
    properties: {},
    geometry:
      g.type === 'Polygon'
        ? { type: 'Polygon', coordinates: g.arcs.map(ring) }
        : { type: 'MultiPolygon', coordinates: g.arcs.map((p: number[][]) => p.map(ring)) },
  }));
}
