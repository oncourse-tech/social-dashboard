import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";

// Shared team password — set via TEAM_PASSWORD env var
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "oncourse2026";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        name: { label: "Name", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.name || !credentials?.password) return null;

        // Verify shared team password
        if (credentials.password !== TEAM_PASSWORD) {
          throw new Error("Invalid password");
        }

        const name = credentials.name.trim();
        const email = `${name.toLowerCase().replace(/\s+/g, ".")}@oncourse.team`;

        // Find or create user
        let user = await db.user.findUnique({ where: { email } });
        if (!user) {
          user = await db.user.create({
            data: { email, name },
          });
        }
        return user;
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
