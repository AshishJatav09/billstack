import { isActiveModule, shouldShowWorkspaceNavigation } from "./workspaceVisibility.js";

export const consumeCreateIntent = (search) => {
  const params = new URLSearchParams(search);
  if (params.get("action") !== "create") return null;
  params.delete("action");
  const remaining = params.toString();
  return remaining ? `?${remaining}` : "";
};

export const canLaunchCreate = (moduleKey, modules, business, user, roles) =>
  isActiveModule(modules, moduleKey) &&
  shouldShowWorkspaceNavigation(moduleKey, modules, business) &&
  (!roles?.length || roles.includes(user?.role));
