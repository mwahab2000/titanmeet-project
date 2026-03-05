import { createTheme } from "@mui/material/styles";

export const muiCorporateTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1a56db", light: "#3b82f6", dark: "#1e40af", contrastText: "#fff" },
    secondary: { main: "#0f766e", light: "#14b8a6", dark: "#115e59" },
    background: { default: "#f8fafc", paper: "#ffffff" },
    text: { primary: "#0f172a", secondary: "#475569" },
    divider: "#e2e8f0",
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica Neue', sans-serif",
    h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
    subtitle1: { fontWeight: 500, color: "#475569" },
    subtitle2: { fontWeight: 500, color: "#64748b", fontSize: "0.8125rem" },
    body1: { lineHeight: 1.7 },
    body2: { lineHeight: 1.6, color: "#475569" },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { letterSpacing: "0.12em", fontWeight: 700, fontSize: "0.7rem" },
  },
  shape: { borderRadius: 12 },
  shadows: [
    "none",
    "0 1px 2px 0 rgba(0,0,0,0.05)",
    "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
    "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
    "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
    "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
    "0 25px 50px -12px rgba(0,0,0,0.25)",
    ...Array(18).fill("0 25px 50px -12px rgba(0,0,0,0.25)"),
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: "10px 24px", fontSize: "0.9rem" },
        containedPrimary: {
          boxShadow: "0 1px 3px 0 rgba(26,86,219,0.3)",
          "&:hover": { boxShadow: "0 4px 12px 0 rgba(26,86,219,0.35)" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
          transition: "box-shadow 0.25s ease, border-color 0.25s ease",
          "&:hover": {
            boxShadow: "0 10px 30px -8px rgba(0,0,0,0.1)",
            borderColor: "#cbd5e1",
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
          backgroundColor: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          color: "#0f172a",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
  },
});
