import { authUsers, type User, type UpsertUser } from "@shared/models/auth";
import { users as legacyUsers, userRoles } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Extended user type that includes legacy data
export interface ExtendedUser extends User {
  legacyUserId?: string;
  displayName?: string;
  role?: string;
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<ExtendedUser | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<ExtendedUser | undefined> {
    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    
    if (!authUser) return undefined;
    
    // Try to find linked legacy user by email
    if (authUser.email) {
      const [legacyUser] = await db.select().from(legacyUsers).where(eq(legacyUsers.email, authUser.email));
      
      if (legacyUser) {
        // Get user role
        const [roleRecord] = await db.select().from(userRoles).where(eq(userRoles.userId, legacyUser.id));
        
        return {
          ...authUser,
          legacyUserId: legacyUser.id,
          displayName: legacyUser.displayName || undefined,
          role: roleRecord?.role || 'member',
        };
      }
    }
    
    return authUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(authUsers)
      .values(userData)
      .onConflictDoUpdate({
        target: authUsers.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
