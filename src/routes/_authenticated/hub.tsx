import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "./home";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({
    meta: [
      { title: "Subsidiaries — IITEG Workspace" },
      { name: "description", content: "Browse iiteg subsidiaries and jump into their modules." },
      { property: "og:title", content: "Subsidiaries — IITEG Workspace" },
      { property: "og:description", content: "Browse iiteg subsidiaries and jump into their modules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubsPage,
});

function SubsPage() {
  return <Workspace initialView={{ kind: "sub", slug: "example-studio" }} />;
}
