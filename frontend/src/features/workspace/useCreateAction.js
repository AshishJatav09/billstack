import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { uiStore } from "../../store/uiStore";
import { getBusinessModulesRequest } from "../auth/api";
import { canLaunchCreate, consumeCreateIntent } from "./createActionIntent";

// Consume the URL intent once. Forms and mutations stay in their existing pages.
export const useCreateAction = ({ ready = true, moduleKey, roles, onCreate, focusSelector }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const callback = useRef(onCreate);
  callback.current = onCreate;
  const rolesKey = JSON.stringify(roles || []);
  useEffect(() => {
    const search = consumeCreateIntent(location.search);
    if (!ready || search === null) return;
    let current = true;
    getBusinessModulesRequest().then((modules) => {
      if (!current) return;
      const { business, user } = authStore.getState();
      navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true, state: location.state });
      if (!canLaunchCreate(moduleKey, modules, business, user, JSON.parse(rolesKey))) {
        uiStore.getState().pushToast({ tone: "error", message: "This action is not available in your workspace." });
        return;
      }
      callback.current();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const field = document.querySelector(focusSelector);
        field?.scrollIntoView({ block: "center", behavior: "auto" });
        field?.focus({ preventScroll: true });
      }));
    }).catch(() => {
      if (!current) return;
      navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true, state: location.state });
      uiStore.getState().pushToast({ tone: "error", message: "Unable to open this action. Please try again." });
    });
    return () => { current = false; };
  }, [ready, moduleKey, rolesKey, focusSelector, location.key, location.search, location.pathname, navigate]);
};
