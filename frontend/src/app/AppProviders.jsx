import { useEffect } from "react";
import ToastViewport from "../components/ui/ToastViewport";
import { uiStore } from "../store/uiStore";

const AppProviders = ({ children }) => {
  const { theme } = uiStore();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
};

export default AppProviders;
