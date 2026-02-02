import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  users, sessions, participants, submissions, aiReports,
  studyResponses, prayers, prayerAmens, prayerComments,
  featureToggles, potentialMembers, icebreakerGames, icebreakerPlayers,
  cardQuestions, messageCards, messageCardDownloads, userRoles,
  User, InsertUser, Session, InsertSession, Participant, InsertParticipant,
  Submission, InsertSubmission, Prayer, InsertPrayer, StudyResponse, InsertStudyResponse,
  FeatureToggle, PotentialMember, IcebreakerGame, IcebreakerPlayer, CardQuestion,
  AiReport, MessageCard, MessageCardDownload
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  getUserRoles(): Promise<{ userId: string; role: string }[]>;
  getUserRole(userId: string): Promise<string | undefined>;
  upsertUserRole(userId: string, role: string): Promise<void>;
  
  getSession(id: string): Promise<Session | undefined>;
  getSessions(): Promise<Session[]>;
  getSessionByShortCode(shortCode: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, data: Partial<Session>): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  
  getParticipants(sessionId: string): Promise<Participant[]>;
  getParticipant(id: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, data: Partial<Participant>): Promise<Participant | undefined>;
  
  getSubmissions(sessionId: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  
  getAiReports(sessionId: string): Promise<AiReport[]>;
  createAiReport(report: { sessionId: string; reportType: string; groupNumber?: number; content: string; status?: string }): Promise<AiReport>;
  
  getStudyResponse(sessionId: string, participantId: string): Promise<StudyResponse | undefined>;
  upsertStudyResponse(response: InsertStudyResponse & { sessionId: string; userId: string }): Promise<StudyResponse>;
  
  getPrayers(): Promise<Prayer[]>;
  createPrayer(prayer: InsertPrayer): Promise<Prayer>;
  updatePrayer(id: string, data: Partial<Prayer>): Promise<Prayer | undefined>;
  deletePrayer(id: string): Promise<void>;
  
  getFeatureToggles(): Promise<FeatureToggle[]>;
  getFeatureToggle(key: string): Promise<FeatureToggle | undefined>;
  updateFeatureToggle(id: string, data: Partial<FeatureToggle>): Promise<FeatureToggle | undefined>;
  
  getPotentialMembers(): Promise<PotentialMember[]>;
  upsertPotentialMember(data: { email: string; name: string; gender?: string }): Promise<PotentialMember>;
  updatePotentialMember(id: string, data: Partial<PotentialMember>): Promise<PotentialMember | undefined>;
  deletePotentialMember(id: string): Promise<void>;
  
  getStudyResponses(sessionId: string): Promise<StudyResponse[]>;
  
  getIcebreakerGame(id: string): Promise<IcebreakerGame | undefined>;
  getIcebreakerGameByRoomCode(roomCode: string): Promise<IcebreakerGame | undefined>;
  createIcebreakerGame(game: Partial<IcebreakerGame>): Promise<IcebreakerGame>;
  updateIcebreakerGame(id: string, data: Partial<IcebreakerGame>): Promise<IcebreakerGame | undefined>;
  
  getIcebreakerPlayers(gameId: string): Promise<IcebreakerPlayer[]>;
  createIcebreakerPlayer(player: { gameId: string; displayName: string; gender?: string; participantId?: string }): Promise<IcebreakerPlayer>;
  
  getCardQuestions(level?: string): Promise<CardQuestion[]>;
  
  getMessageCards(): Promise<MessageCard[]>;
  getMessageCard(shortCode: string): Promise<MessageCard | undefined>;
  createMessageCard(card: { title: string; shortCode: string; imagePath: string; createdBy?: string }): Promise<MessageCard>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUserRoles(): Promise<{ userId: string; role: string }[]> {
    return db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles);
  }

  async getUserRole(userId: string): Promise<string | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId)).limit(1);
    return role?.role;
  }

  async upsertUserRole(userId: string, role: string): Promise<void> {
    const existing = await db.select().from(userRoles).where(eq(userRoles.userId, userId)).limit(1);
    if (existing.length > 0) {
      await db.update(userRoles).set({ role }).where(eq(userRoles.userId, userId));
    } else {
      await db.insert(userRoles).values({ userId, role });
    }
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return session;
  }

  async getSessions(): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.createdAt));
  }

  async getSessionByShortCode(shortCode: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.shortCode, shortCode)).limit(1);
    return session;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const [newSession] = await db.insert(sessions).values({ ...session, shortCode }).returning();
    return newSession;
  }

  async updateSession(id: string, data: Partial<Session>): Promise<Session | undefined> {
    const [updated] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(aiReports).where(eq(aiReports.sessionId, id));
    await db.delete(submissions).where(eq(submissions.sessionId, id));
    await db.delete(studyResponses).where(eq(studyResponses.sessionId, id));
    await db.delete(participants).where(eq(participants.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getParticipants(sessionId: string): Promise<Participant[]> {
    return db.select().from(participants).where(eq(participants.sessionId, sessionId));
  }

  async getParticipant(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
    return participant;
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    await this.upsertPotentialMember({ email: participant.email, name: participant.name, gender: participant.gender });
    return newParticipant;
  }

  async updateParticipant(id: string, data: Partial<Participant>): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ ...data, updatedAt: new Date() }).where(eq(participants.id, id)).returning();
    return updated;
  }

  async getSubmissions(sessionId: string): Promise<Submission[]> {
    return db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [newSubmission] = await db.insert(submissions).values(submission).returning();
    return newSubmission;
  }

  async getAiReports(sessionId: string): Promise<AiReport[]> {
    return db.select().from(aiReports).where(eq(aiReports.sessionId, sessionId));
  }

  async createAiReport(report: { sessionId: string; reportType: string; groupNumber?: number; content: string; status?: string }): Promise<AiReport> {
    const [newReport] = await db.insert(aiReports).values(report).returning();
    return newReport;
  }

  async getStudyResponse(sessionId: string, participantId: string): Promise<StudyResponse | undefined> {
    const [response] = await db.select().from(studyResponses)
      .where(and(eq(studyResponses.sessionId, sessionId), eq(studyResponses.userId, participantId))).limit(1);
    return response;
  }

  async upsertStudyResponse(response: InsertStudyResponse & { sessionId: string; userId: string }): Promise<StudyResponse> {
    const existing = await this.getStudyResponse(response.sessionId, response.userId);
    if (existing) {
      const [updated] = await db.update(studyResponses)
        .set({ ...response, updatedAt: new Date() })
        .where(eq(studyResponses.id, existing.id))
        .returning();
      return updated;
    }
    const [newResponse] = await db.insert(studyResponses).values(response).returning();
    return newResponse;
  }

  async getPrayers(): Promise<Prayer[]> {
    return db.select().from(prayers).orderBy(desc(prayers.createdAt));
  }

  async createPrayer(prayer: InsertPrayer): Promise<Prayer> {
    const [newPrayer] = await db.insert(prayers).values(prayer).returning();
    return newPrayer;
  }

  async updatePrayer(id: string, data: Partial<Prayer>): Promise<Prayer | undefined> {
    const [updated] = await db.update(prayers).set({ ...data, updatedAt: new Date() }).where(eq(prayers.id, id)).returning();
    return updated;
  }

  async deletePrayer(id: string): Promise<void> {
    await db.delete(prayers).where(eq(prayers.id, id));
  }

  async getFeatureToggles(): Promise<FeatureToggle[]> {
    return db.select().from(featureToggles);
  }

  async getFeatureToggle(key: string): Promise<FeatureToggle | undefined> {
    const [toggle] = await db.select().from(featureToggles).where(eq(featureToggles.featureKey, key)).limit(1);
    return toggle;
  }

  async updateFeatureToggle(id: string, data: Partial<FeatureToggle>): Promise<FeatureToggle | undefined> {
    const [updated] = await db.update(featureToggles).set({ ...data, updatedAt: new Date() }).where(eq(featureToggles.id, id)).returning();
    return updated;
  }

  async getPotentialMembers(): Promise<PotentialMember[]> {
    return db.select().from(potentialMembers);
  }

  async upsertPotentialMember(data: { email: string; name: string; gender?: string }): Promise<PotentialMember> {
    const existing = await db.select().from(potentialMembers).where(eq(potentialMembers.email, data.email)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(potentialMembers)
        .set({ name: data.name, gender: data.gender, lastSessionAt: new Date(), sessionsCount: sql`${potentialMembers.sessionsCount} + 1` })
        .where(eq(potentialMembers.email, data.email))
        .returning();
      return updated;
    }
    const [newMember] = await db.insert(potentialMembers).values(data).returning();
    return newMember;
  }

  async updatePotentialMember(id: string, data: Partial<PotentialMember>): Promise<PotentialMember | undefined> {
    const [updated] = await db.update(potentialMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(potentialMembers.id, id))
      .returning();
    return updated;
  }

  async deletePotentialMember(id: string): Promise<void> {
    await db.delete(potentialMembers).where(eq(potentialMembers.id, id));
  }

  async getStudyResponses(sessionId: string): Promise<StudyResponse[]> {
    return db.select().from(studyResponses).where(eq(studyResponses.sessionId, sessionId));
  }

  async getIcebreakerGame(id: string): Promise<IcebreakerGame | undefined> {
    const [game] = await db.select().from(icebreakerGames).where(eq(icebreakerGames.id, id)).limit(1);
    return game;
  }

  async getIcebreakerGameByRoomCode(roomCode: string): Promise<IcebreakerGame | undefined> {
    const [game] = await db.select().from(icebreakerGames).where(eq(icebreakerGames.roomCode, roomCode)).limit(1);
    return game;
  }

  async createIcebreakerGame(game: Partial<IcebreakerGame>): Promise<IcebreakerGame> {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const [newGame] = await db.insert(icebreakerGames).values({ ...game, roomCode } as any).returning();
    return newGame;
  }

  async updateIcebreakerGame(id: string, data: Partial<IcebreakerGame>): Promise<IcebreakerGame | undefined> {
    const [updated] = await db.update(icebreakerGames).set({ ...data, updatedAt: new Date() }).where(eq(icebreakerGames.id, id)).returning();
    return updated;
  }

  async getIcebreakerPlayers(gameId: string): Promise<IcebreakerPlayer[]> {
    return db.select().from(icebreakerPlayers).where(eq(icebreakerPlayers.gameId, gameId));
  }

  async createIcebreakerPlayer(player: { gameId: string; displayName: string; gender?: string; participantId?: string }): Promise<IcebreakerPlayer> {
    const [newPlayer] = await db.insert(icebreakerPlayers).values(player).returning();
    return newPlayer;
  }

  async getCardQuestions(level?: string): Promise<CardQuestion[]> {
    if (level) {
      return db.select().from(cardQuestions).where(and(eq(cardQuestions.level, level), eq(cardQuestions.isActive, true)));
    }
    return db.select().from(cardQuestions).where(eq(cardQuestions.isActive, true));
  }

  async getMessageCards(): Promise<MessageCard[]> {
    return db.select().from(messageCards).where(eq(messageCards.isActive, true));
  }

  async getAllMessageCards(): Promise<MessageCard[]> {
    return db.select().from(messageCards).orderBy(desc(messageCards.createdAt));
  }

  async getMessageCard(shortCode: string): Promise<MessageCard | undefined> {
    const [card] = await db.select().from(messageCards).where(eq(messageCards.shortCode, shortCode)).limit(1);
    return card;
  }

  async createMessageCard(card: { title: string; shortCode: string; imagePath: string; createdBy?: string }): Promise<MessageCard> {
    const [newCard] = await db.insert(messageCards).values(card).returning();
    return newCard;
  }

  async getMessageCardDownloads(): Promise<MessageCardDownload[]> {
    return db.select().from(messageCardDownloads).orderBy(desc(messageCardDownloads.downloadedAt));
  }
}

export const storage = new DatabaseStorage();
