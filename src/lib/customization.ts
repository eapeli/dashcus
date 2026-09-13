export type FontSize = 'small' | 'medium' | 'large';
export type FontFamily = 'inter' | 'poppins' | 'montserrat' | 'nunito' | 'source-sans' | 'merriweather' | 'system' | 'serif' | 'mono';

export interface CustomizationPreferences {
  backgroundColor: string;
  backgroundImage: string;
  backgroundOpacity: number;
  sidebarColor: string;
  accentColor: string;
  fontSize: FontSize;
  fontFamily: FontFamily;
}

export const DEFAULT_CUSTOMIZATION: CustomizationPreferences = {
  backgroundColor: '#f8fafc',
  backgroundImage: '',
  backgroundOpacity: 0.35,
  sidebarColor: '#0f172a',
  accentColor: '#2563eb',
  fontSize: 'medium',
  fontFamily: 'inter',
};

export const FONT_SIZE_VALUES: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
};

export const FONT_FAMILY_VALUES: Record<FontFamily, string> = {
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  montserrat: "'Montserrat', system-ui, sans-serif",
  nunito: "'Nunito', system-ui, sans-serif",
  'source-sans': "'Source Sans 3', system-ui, sans-serif",
  merriweather: "'Merriweather', Georgia, serif",
  system: 'system-ui, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};
