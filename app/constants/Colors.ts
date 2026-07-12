const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export const Colors = {
  primary: '#355F2E',    // Dark green
  secondary: '#A8CD89',  // Light green
  background: '#F4E0AF', // Light yellow
  accent: '#F9C0AB',     // Light red/coral
  error: '#8B0000',      // Dark red
  highlight: '#FF8C42',  // Vibrant orange - new color for the add button
  darkGrey: '#444444',
};

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
