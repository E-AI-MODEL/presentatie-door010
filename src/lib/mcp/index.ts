import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyAppointments from "./tools/list-my-appointments";
import listMyConversations from "./tools/list-my-conversations";
import getConversationMessages from "./tools/get-conversation-messages";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "doorai-mcp",
  title: "DoorAI",
  version: "0.1.0",
  instructions:
    "Tools for the DoorAI Rotterdam education-transition app. Read the signed-in user's profile, appointments with an advisor, and DoorAI conversations. All access is scoped to the authenticated user via Supabase RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfile,
    listMyAppointments,
    listMyConversations,
    getConversationMessages,
  ],
});
