import type { CSSProperties } from "react";

export type StrandsProps = {
  colors?: string[];
  count?: number;
  speed?: number;
  amplitude?: number;
  waviness?: number;
  energy?: number;
  thickness?: number;
  spread?: number;
  glow?: number;
  taper?: number;
  intensity?: number;
  saturation?: number;
  hueShift?: number;
  scale?: number;
  glass?: boolean;
  glassSize?: number;
  refraction?: number;
  rim?: number;
  dispersion?: number;
  listening?: boolean;
  level?: number;
  interactive?: boolean;
  clickPulse?: boolean;
  intro?: boolean;
  lightMode?: boolean;
  opacity?: number;
  maxDevicePixelRatio?: number;
  className?: string;
  style?: CSSProperties;
};

export default function Strands(props: StrandsProps): JSX.Element;
