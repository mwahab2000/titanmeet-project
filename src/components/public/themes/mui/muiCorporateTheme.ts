import { createTheme } from "@mui/material/styles";

export const muiCorporateTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#c9a84c", light: "#e0c068", dark: "#a88a3a", contrastText: "#0a0f1e" },
    secondary: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb" },
    background: { default: "#0a0f1e", paper: "#0d1528" },
    text: { primary: "#e8e6e1", secondary: "#8b95a8" },
    divider: "rgba(255,255,255,0.08)",
    error: { main: "#ef4444" },
    success: { main: "#10b981" },
    warning: { main: "#f59e0b" },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica Neue', sans-serif",
    h1: { fontFamily: "'Playfair Display', 'Georgia', serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: "'Playfair Display', 'Georgia', serif", fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontFamily: "'Playfair Display', 'Georgia', serif", fontWeight: 700 },
    h4: { fontFamily: "'Playfair Display', 'Georgia', serif", fontWeight: 700 },
    h5: { fontFamily: "'Inter', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Inter', sans-serif", fontWeight: 600 },
    subtitle1: { fontWeight: 500, color: "#8b95a8" },
    subtitle2: { fontWeight: 500, color: "#6b7a90", fontSize: "0.8125rem" },
    body1: { lineHeight: 1.7, color: "#c0c5d0" },
    body2: { lineHeight: 1.6, color: "#8b95a8" },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { letterSpacing: "0.15em", fontWeight: 700, fontSize: "0.65rem" },
  },
  shape: { borderRadius: 12 },
  shadows: [
    "none",
    "0 1px 2px 0 rgba(0,0,0,0.3)",
    "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.3)",
    "0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)",
    "0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3)",
    "0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3)",
    "0 25px 50px -12px rgba(0,0,0,0.5)",
    ...Array(18).fill("0 25px 50px -12px rgba(0,0,0,0.5)"),
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: "10px 28px", fontSize: "0.9rem" },
        containedPrimary: {
          background: "linear-gradient(135deg, #c9a84c, #e0c068)",
          color: "#0a0f1e",
          fontWeight: 700,
          boxShadow: "0 2px 12px 0 rgba(201,168,76,0.25)",
          "&:hover": { boxShadow: "0 4px 20px 0 rgba(201,168,76,0.35)", background: "linear-gradient(135deg, #d4b458, #e8cc78)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "#0d1528",
          boxShadow: "0 2px 8px 0 rgba(0,0,0,0.2)",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          "&:hover": {
            borderColor: "rgba(201,168,76,0.2)",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.3)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.75rem" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(10,15,30,0.92)",
          backdropFilter: "blur(16px)",
          color: "#e8e6e1",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14, backgroundColor: "#0d1528" },
        outlined: { borderColor: "rgba(255,255,255,0.06)" },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "rgba(255,255,255,0.08)" },
      },
    },
  },
});
