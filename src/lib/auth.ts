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
        console.log("[AUTH] authorize called, password length:", credentials?.password?.length, "expected length:", TEAM_PASSWORD.length);
        console.log("[AUTH] match:", credentials?.password === TEAM_PASSWORD);

        if (!credentials?.password) return null;

        if (credentials.password !== TEAM_PASSWORD) {
          console.log("[AUTH] password mismatch");
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
