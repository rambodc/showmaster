import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function RouteScrollRestoration() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
    document.querySelectorAll("[data-route-scroll-container]").forEach((element) => {
      element.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
  }, [pathname]);

  return null;
}
