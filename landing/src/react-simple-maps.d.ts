declare module 'react-simple-maps' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react';

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (data: { geographies: GeoType[] }) => ReactNode;
  }

  interface GeoType {
    rsmKey: string;
    id?: string;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface GeoStyleMap {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  }

  interface GeographyProps {
    geography: GeoType;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeoStyleMap;
    tabIndex?: number;
    role?: string;
    className?: string;
    [key: string]: unknown;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
}
