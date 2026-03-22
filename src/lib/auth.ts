import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Shared team password — set via TEAM_PASSWORD env var
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "oncourse2026";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;

        if (credentials.password !== TEAM_PASSWORD.trim()) {
          return null;
        }

        // Return a static user — no DB needed for auth
        return {
          id: "oncourse-team",
          name: "oncourse team",
          email: "team@oncourse.internal",
        };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
