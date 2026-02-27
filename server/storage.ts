import { db } from "./db";
import { eq, and, desc, sql, asc, like, or, isNull, inArray } from "drizzle-orm";
import { bibleCache, timelineCache, cacheKeys } from "./cache";
import {
  users, sessions, participants, submissions, aiReports,
  studyResponses, prayers, prayerAmens, prayerComments,
  featureToggles, potentialMembers, icebreakerGames, icebreakerPlayers,
  cardQuestions, messageCards, messageCardDownloads, userRoles,
  chineseUnionTrad, jesus4Seasons, jesusDailyContent, readingPlanTemplates, readingPlanTemplateItems, blessingVerses, savedVerses,
  groupingActivities, groupingParticipants,
  prayerMeetings, prayerMeetingParticipants,
  userReadingPlans, userReadingProgress, devotionalNotes,
  User, InsertUser, Session, InsertSession, Participant, InsertParticipant,
  Submission, InsertSubmission, Prayer, InsertPrayer, StudyResponse, InsertStudyResponse,
  FeatureToggle, PotentialMember, IcebreakerGame, IcebreakerPlayer, CardQuestion,
  AiReport, MessageCard, MessageCardDownload,
  ChineseUnionTrad, Jesus4Season, JesusDailyContent, ReadingPlanTemplate, ReadingPlanTemplateItem, BlessingVerse, SavedVerse, InsertSavedVerse,
  UserReadingPlan, InsertUserReadingPlan, UserReadingProgress, InsertUserReadingProgress,
  DevotionalNote, InsertDevotionalNote, InsertReadingPlanTemplate,
  PrayerMeeting, InsertPrayerMeeting, PrayerMeetingParticipant, InsertPrayerMeetingParticipant,
  GroupingActivity, GroupingParticipant, InsertGroupingActivity, InsertGroupingParticipant,
  inboxEmails, InboxEmail, InsertInboxEmail
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
  
  getParticipants(sessionId: string, filters?: { groupNumber?: number }): Promise<Participant[]>;
  getParticipant(id: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, data: Partial<Participant>): Promise<Participant | undefined>;
  deleteParticipantsBySession(sessionId: string): Promise<void>;
  forceVerifyAllParticipants(sessionId: string): Promise<number>;
  resetAllReadyStatus(sessionId: string): Promise<number>;
  clearAllGroupAssignments(sessionId: string): Promise<number>;
  
  getSubmissions(sessionId: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  deleteSubmissionsBySession(sessionId: string): Promise<void>;
  
  getAiReports(sessionId: string): Promise<AiReport[]>;
  createAiReport(report: { sessionId: string; reportType: string; groupNumber?: number; content: string; status?: string }): Promise<AiReport>;
  
  getStudyResponse(sessionId: string, participantId: string): Promise<StudyResponse | undefined>;
  upsertStudyResponse(response: InsertStudyResponse & { sessionId: string; userId: string }): Promise<StudyResponse>;
  updateStudyResponseById(id: string, data: Partial<InsertStudyResponse>): Promise<StudyResponse | undefined>;
  getStudyResponseWithOwner(id: string): Promise<{ id: string; userId: string; ownerEmail: string | null } | undefined>;
  deleteStudyResponse(id: string): Promise<void>;
  getNotebookEntries(email: string): Promise<any[]>;
  getNotebookSessions(email: string): Promise<any[]>;
  getGroupStudyResponses(sessionId: string, groupNumber: number): Promise<any[]>;
  
  getPrayers(): Promise<Prayer[]>;
  createPrayer(prayer: InsertPrayer): Promise<Prayer>;
  updatePrayer(id: string, data: Partial<Prayer>): Promise<Prayer | undefined>;
  deletePrayer(id: string): Promise<void>;
  createPrayerAmen(prayerId: string, userId: string): Promise<{ prayerId: string; userId: string }>;
  getPrayerComments(prayerId: string, currentUserId?: string): Promise<{ id: string; prayerId: string; userId: string; content: string; createdAt: Date; authorName: string; authorAvatar: string | null; isOwner: boolean }[]>;
  createPrayerComment(prayerId: string, userId: string, content: string): Promise<{ id: string; prayerId: string; userId: string; content: string; createdAt: Date }>;
  deletePrayerComment(commentId: string): Promise<void>;
  
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
  getAllCardQuestions(): Promise<CardQuestion[]>;
  getCardQuestionById(id: string): Promise<CardQuestion | undefined>;
  createCardQuestion(question: { contentText: string; contentTextEn?: string; level: string; isActive: boolean; sortOrder: number }): Promise<CardQuestion>;
  updateCardQuestion(id: string, updates: Partial<CardQuestion>): Promise<CardQuestion | undefined>;
  deleteCardQuestion(id: string): Promise<boolean>;
  
  getSessionIcebreakerGame(sessionId: string, groupNumber: number): Promise<IcebreakerGame | undefined>;
  drawIcebreakerCard(gameId: string, level: string): Promise<{ cardId: string | null; cardContent: string | null; cardLevel: string; cardsRemaining: number }>;
  resetIcebreakerDeck(gameId: string): Promise<void>;
  
  getMessageCards(): Promise<MessageCard[]>;
  getAllMessageCards(): Promise<MessageCard[]>;
  getMessageCard(shortCode: string): Promise<MessageCard | undefined>;
  getMessageCardById(id: string): Promise<MessageCard | undefined>;
  createMessageCard(card: { title: string; shortCode: string; imagePath: string; createdBy?: string }): Promise<MessageCard>;
  updateMessageCard(id: string, data: Partial<{ title: string; imagePath: string; isActive: boolean }>): Promise<MessageCard | undefined>;
  
  // Grouping Activities
  getGroupingActivities(): Promise<GroupingActivity[]>;
  getGroupingActivity(id: string): Promise<GroupingActivity | undefined>;
  getGroupingActivityByCode(shortCode: string): Promise<GroupingActivity | undefined>;
  getActiveGroupingActivitiesByOwner(ownerId: string): Promise<GroupingActivity[]>;
  createGroupingActivity(activity: InsertGroupingActivity): Promise<GroupingActivity>;
  updateGroupingActivity(id: string, data: Partial<GroupingActivity>): Promise<GroupingActivity | undefined>;
  getGroupingParticipants(activityId: string): Promise<GroupingParticipant[]>;
  addGroupingParticipant(participant: InsertGroupingParticipant): Promise<GroupingParticipant>;
  updateGroupingParticipants(activityId: string, updates: { id: string; groupNumber: number }[]): Promise<void>;
  deleteGroupingActivity(id: string): Promise<void>;
  generateUniqueShortCode(): Promise<string>;

  // Prayer Meetings
  getPrayerMeetings(): Promise<PrayerMeeting[]>;
  getPrayerMeeting(id: string): Promise<PrayerMeeting | undefined>;
  getPrayerMeetingByCode(shortCode: string): Promise<PrayerMeeting | undefined>;
  getActivePrayerMeetingsByOwner(ownerId: string): Promise<PrayerMeeting[]>;
  getClosedPrayerMeetings(): Promise<PrayerMeeting[]>;
  createPrayerMeeting(meeting: InsertPrayerMeeting): Promise<PrayerMeeting>;
  updatePrayerMeeting(id: string, data: Partial<PrayerMeeting>): Promise<PrayerMeeting | undefined>;
  updatePrayerMeetingStatus(id: string, status: string): Promise<PrayerMeeting | undefined>;
  deletePrayerMeeting(id: string): Promise<void>;
  getPrayerMeetingParticipants(meetingId: string): Promise<PrayerMeetingParticipant[]>;
  getPrayerMeetingParticipantById(id: string): Promise<PrayerMeetingParticipant | undefined>;
  addPrayerMeetingParticipant(participant: InsertPrayerMeetingParticipant): Promise<PrayerMeetingParticipant>;
  updatePrayerMeetingParticipant(id: string, data: Partial<PrayerMeetingParticipant>): Promise<PrayerMeetingParticipant | undefined>;
  updatePrayerMeetingParticipants(meetingId: string, updates: { id: string; groupNumber: number }[]): Promise<void>;
  generateUniquePrayerMeetingCode(): Promise<string>;

  deleteAiReport(id: string): Promise<void>;
  
  getBibleBooks(): Promise<{ bookName: string; bookNumber: number; chapterCount: number }[]>;
  getBibleChapters(bookName: string): Promise<{ chapter: number; verseCount: number }[]>;
  getBibleVerses(bookName: string, chapter: number): Promise<ChineseUnionTrad[]>;
  searchBibleVerses(query: string, limit?: number): Promise<ChineseUnionTrad[]>;
  getBlessingVerses(type?: string): Promise<BlessingVerse[]>;
  getRandomBlessingVerse(): Promise<BlessingVerse | undefined>;
  
  getJesus4Seasons(): Promise<Jesus4Season[]>;
  getJesus4SeasonsBySeason(season: string): Promise<Jesus4Season[]>;
  getJesusDailyContent(season?: string): Promise<JesusDailyContent[]>;
  
  getReadingPlanTemplates(): Promise<ReadingPlanTemplate[]>;
  getReadingPlanTemplate(id: string): Promise<ReadingPlanTemplate | undefined>;
  getReadingPlanItems(templateId: string): Promise<ReadingPlanTemplateItem[]>;
  
  getSavedVerses(userId: string): Promise<SavedVerse[]>;
  getSavedVerse(userId: string, bookName: string, chapter: number, verse: number): Promise<SavedVerse | undefined>;
  createSavedVerse(data: InsertSavedVerse): Promise<SavedVerse>;
  deleteSavedVerse(id: string): Promise<void>;

  getUserReadingPlans(userId: string): Promise<UserReadingPlan[]>;
  getUserReadingPlan(id: string): Promise<UserReadingPlan | undefined>;
  createUserReadingPlan(plan: InsertUserReadingPlan): Promise<UserReadingPlan>;
  updateUserReadingPlan(id: string, updates: Partial<InsertUserReadingPlan>): Promise<UserReadingPlan | undefined>;
  deleteUserReadingPlan(id: string): Promise<void>;

  getUserReadingProgress(planId: string): Promise<UserReadingProgress[]>;
  getUserTodayProgress(userId: string): Promise<UserReadingProgress[]>;
  markReadingComplete(id: string): Promise<UserReadingProgress | undefined>;
  createReadingProgress(progress: InsertUserReadingProgress): Promise<UserReadingProgress>;

  getDevotionalNote(id: string): Promise<DevotionalNote | undefined>;
  getDevotionalNotes(userId: string): Promise<DevotionalNote[]>;
  getDevotionalNoteByPlanDay(planId: string, dayNumber: number): Promise<DevotionalNote | undefined>;
  createDevotionalNote(note: InsertDevotionalNote): Promise<DevotionalNote>;
  updateDevotionalNote(id: string, updates: Partial<InsertDevotionalNote>): Promise<DevotionalNote | undefined>;
  getDevotionalNoteByVerseReference(userId: string, verseReference: string): Promise<DevotionalNote | undefined>;

  createReadingPlanTemplate(template: InsertReadingPlanTemplate): Promise<ReadingPlanTemplate>;
  createReadingPlanTemplateItems(items: Array<{templateId: string, dayNumber: number, bookName?: string, chapterStart?: number, chapterEnd?: number, scriptureReference?: string}>): Promise<void>;

  getInboxEmails(options?: { archived?: boolean; limit?: number; offset?: number }): Promise<InboxEmail[]>;
  getInboxEmail(id: number): Promise<InboxEmail | undefined>;
  createInboxEmail(email: InsertInboxEmail): Promise<InboxEmail>;
  markInboxEmailRead(id: number, isRead: boolean): Promise<InboxEmail | undefined>;
  archiveInboxEmail(id: number, isArchived: boolean): Promise<InboxEmail | undefined>;
  getInboxUnreadCount(): Promise<number>;
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
    const shortCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const [newSession] = await db.insert(sessions).values({ ...session, shortCode }).returning();
    return newSession;
  }

  async updateSession(id: string, data: Partial<Session>): Promise<Session | undefined> {
    const [updated] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    const sessionGames = await db.select({ id: icebreakerGames.id }).from(icebreakerGames).where(eq(icebreakerGames.bibleStudySessionId, id));
    if (sessionGames.length > 0) {
      const gameIds = sessionGames.map(g => g.id);
      await db.delete(icebreakerPlayers).where(inArray(icebreakerPlayers.gameId, gameIds));
      await db.delete(icebreakerGames).where(inArray(icebreakerGames.id, gameIds));
    }
    await db.delete(aiReports).where(eq(aiReports.sessionId, id));
    await db.delete(submissions).where(eq(submissions.sessionId, id));
    await db.delete(studyResponses).where(eq(studyResponses.sessionId, id));
    await db.delete(participants).where(eq(participants.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async getParticipants(sessionId: string, filters?: { groupNumber?: number }): Promise<Participant[]> {
    const conditions = [eq(participants.sessionId, sessionId)];
    if (filters?.groupNumber !== undefined) {
      conditions.push(eq(participants.groupNumber, filters.groupNumber));
    }
    return db.select().from(participants).where(and(...conditions));
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

  async deleteParticipantsBySession(sessionId: string): Promise<void> {
    await db.delete(participants).where(eq(participants.sessionId, sessionId));
  }

  async forceVerifyAllParticipants(sessionId: string): Promise<number> {
    const result = await db.update(participants)
      .set({ readyConfirmed: true })
      .where(eq(participants.sessionId, sessionId))
      .returning({ id: participants.id });
    return result.length;
  }

  async resetAllReadyStatus(sessionId: string): Promise<number> {
    const result = await db.update(participants)
      .set({ readyConfirmed: false })
      .where(eq(participants.sessionId, sessionId))
      .returning({ id: participants.id });
    return result.length;
  }

  async clearAllGroupAssignments(sessionId: string): Promise<number> {
    const result = await db.update(participants)
      .set({ groupNumber: null, readyConfirmed: false })
      .where(eq(participants.sessionId, sessionId))
      .returning({ id: participants.id });
    return result.length;
  }

  async getSubmissions(sessionId: string): Promise<Submission[]> {
    return db.select().from(submissions).where(eq(submissions.sessionId, sessionId));
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [newSubmission] = await db.insert(submissions).values(submission).returning();
    return newSubmission;
  }

  async deleteSubmissionsBySession(sessionId: string): Promise<void> {
    await db.delete(submissions).where(eq(submissions.sessionId, sessionId));
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

  async updateStudyResponseById(id: string, data: Partial<InsertStudyResponse>): Promise<StudyResponse | undefined> {
    const [updated] = await db.update(studyResponses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studyResponses.id, id))
      .returning();
    return updated;
  }

  async getStudyResponseWithOwner(id: string): Promise<{ id: string; userId: string; ownerEmail: string | null } | undefined> {
    const [result] = await db
      .select({
        id: studyResponses.id,
        userId: studyResponses.userId,
        ownerEmail: participants.email,
      })
      .from(studyResponses)
      .leftJoin(participants, eq(studyResponses.userId, participants.id))
      .where(eq(studyResponses.id, id))
      .limit(1);
    return result;
  }

  async deleteStudyResponse(id: string): Promise<void> {
    await db.delete(studyResponses).where(eq(studyResponses.id, id));
  }

  async getNotebookEntries(email: string): Promise<any[]> {
    const results = await db
      .select({
        id: studyResponses.id,
        sessionId: studyResponses.sessionId,
        titlePhrase: studyResponses.titlePhrase,
        heartbeatVerse: studyResponses.heartbeatVerse,
        observation: studyResponses.observation,
        coreInsightCategory: studyResponses.coreInsightCategory,
        coreInsightNote: studyResponses.coreInsightNote,
        scholarsNote: studyResponses.scholarsNote,
        actionPlan: studyResponses.actionPlan,
        coolDownNote: studyResponses.coolDownNote,
        createdAt: studyResponses.createdAt,
        verseReference: sessions.verseReference,
        sessionCreatedAt: sessions.createdAt,
      })
      .from(studyResponses)
      .innerJoin(participants, eq(studyResponses.userId, participants.id))
      .innerJoin(sessions, eq(studyResponses.sessionId, sessions.id))
      .where(and(eq(participants.email, email), eq(studyResponses.hidden, false)))
      .orderBy(desc(studyResponses.createdAt));

    return results.map(row => ({
      id: row.id,
      session_id: row.sessionId,
      verse_reference: row.verseReference,
      session_date: row.sessionCreatedAt?.toISOString() || row.createdAt.toISOString(),
      title_phrase: row.titlePhrase,
      heartbeat_verse: row.heartbeatVerse,
      observation: row.observation,
      core_insight_category: row.coreInsightCategory,
      core_insight_note: row.coreInsightNote,
      scholars_note: row.scholarsNote,
      action_plan: row.actionPlan,
      cool_down_note: row.coolDownNote,
    }));
  }

  async getNotebookSessions(email: string): Promise<any[]> {
    const results = await db
      .select({
        sessionId: sessions.id,
        verseReference: sessions.verseReference,
        sessionDate: sessions.createdAt,
        groupNumber: participants.groupNumber,
        participantId: participants.id,
      })
      .from(participants)
      .innerJoin(sessions, eq(participants.sessionId, sessions.id))
      .where(eq(participants.email, email))
      .orderBy(desc(sessions.createdAt));
    return results.map(row => ({
      session_id: row.sessionId,
      verse_reference: row.verseReference,
      session_date: row.sessionDate?.toISOString() || '',
      group_number: row.groupNumber,
      participant_id: row.participantId,
    }));
  }

  async getGroupStudyResponses(sessionId: string, groupNumber: number): Promise<any[]> {
    const results = await db
      .select({
        id: studyResponses.id,
        titlePhrase: studyResponses.titlePhrase,
        heartbeatVerse: studyResponses.heartbeatVerse,
        observation: studyResponses.observation,
        coreInsightCategory: studyResponses.coreInsightCategory,
        coreInsightNote: studyResponses.coreInsightNote,
        scholarsNote: studyResponses.scholarsNote,
        actionPlan: studyResponses.actionPlan,
        coolDownNote: studyResponses.coolDownNote,
        participantName: participants.name,
        participantEmail: participants.email,
      })
      .from(studyResponses)
      .innerJoin(participants, eq(studyResponses.userId, participants.id))
      .where(and(
        eq(studyResponses.sessionId, sessionId),
        eq(participants.groupNumber, groupNumber),
        eq(studyResponses.hidden, false)
      ))
      .orderBy(studyResponses.createdAt);
    return results.map(row => ({
      id: row.id,
      title_phrase: row.titlePhrase,
      heartbeat_verse: row.heartbeatVerse,
      observation: row.observation,
      core_insight_category: row.coreInsightCategory,
      core_insight_note: row.coreInsightNote,
      scholars_note: row.scholarsNote,
      action_plan: row.actionPlan,
      cool_down_note: row.coolDownNote,
      participant_name: row.participantName,
      participant_email: row.participantEmail,
    }));
  }

  async toggleStudyResponseHidden(id: string, hidden: boolean): Promise<any> {
    const [updated] = await db.update(studyResponses).set({ hidden, updatedAt: new Date() }).where(eq(studyResponses.id, id)).returning();
    return updated;
  }

  async getPrayers(): Promise<Prayer[]> {
    return db.select().from(prayers).orderBy(desc(prayers.createdAt));
  }

  async createPrayer(prayer: InsertPrayer): Promise<Prayer> {
    const [newPrayer] = await db.insert(prayers).values(prayer).returning();
    return newPrayer;
  }

  async updatePrayer(id: string, data: Partial<Prayer>): Promise<Prayer | undefined> {
    const [updated] = await db.update(prayers).set(data).where(eq(prayers.id, id)).returning();
    return updated;
  }

  async deletePrayer(id: string): Promise<void> {
    await db.delete(prayers).where(eq(prayers.id, id));
  }

  async createPrayerAmen(prayerId: string, userId: string): Promise<{ prayerId: string; userId: string }> {
    await db.insert(prayerAmens).values({ prayerId, userId }).onConflictDoNothing();
    return { prayerId, userId };
  }

  async getPrayerComments(prayerId: string, currentUserId?: string): Promise<{ id: string; prayerId: string; userId: string; content: string; createdAt: Date; authorName: string; authorAvatar: string | null; isOwner: boolean }[]> {
    const comments = await db
      .select({
        id: prayerComments.id,
        prayerId: prayerComments.prayerId,
        userId: prayerComments.userId,
        content: prayerComments.content,
        createdAt: prayerComments.createdAt,
        authorName: users.displayName,
        authorAvatar: users.avatarUrl,
      })
      .from(prayerComments)
      .leftJoin(users, eq(prayerComments.userId, users.id))
      .where(eq(prayerComments.prayerId, prayerId))
      .orderBy(prayerComments.createdAt);
    
    return comments.map(c => ({
      ...c,
      authorName: c.authorName || '匿名',
      isOwner: currentUserId ? c.userId === currentUserId : false,
    }));
  }

  async createPrayerComment(prayerId: string, userId: string, content: string): Promise<{ id: string; prayerId: string; userId: string; content: string; createdAt: Date }> {
    const [comment] = await db.insert(prayerComments).values({ prayerId, userId, content }).returning();
    return comment;
  }

  async deletePrayerComment(commentId: string): Promise<void> {
    await db.delete(prayerComments).where(eq(prayerComments.id, commentId));
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

  async getStudyResponses(sessionId: string): Promise<(StudyResponse & { participantName?: string; groupNumber?: number })[]> {
    const results = await db
      .select({
        response: studyResponses,
        participantName: participants.name,
        participantGroupNumber: participants.groupNumber,
        userName: users.displayName,
        userEmail: users.email,
      })
      .from(studyResponses)
      .leftJoin(participants, eq(studyResponses.userId, participants.id))
      .leftJoin(users, eq(studyResponses.userId, users.id))
      .where(eq(studyResponses.sessionId, sessionId));

    return results.map(row => ({
      ...row.response,
      participantName: row.participantName || row.userName || row.userEmail?.split('@')[0] || 'Unknown',
      groupNumber: row.participantGroupNumber || undefined,
    }));
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

  async getAllCardQuestions(): Promise<CardQuestion[]> {
    return db.select().from(cardQuestions).orderBy(cardQuestions.level, cardQuestions.sortOrder);
  }

  async createCardQuestion(question: { contentText: string; contentTextEn?: string; level: string; isActive: boolean; sortOrder: number }): Promise<CardQuestion> {
    const [newQuestion] = await db.insert(cardQuestions).values(question).returning();
    return newQuestion;
  }

  async updateCardQuestion(id: string, updates: Partial<CardQuestion>): Promise<CardQuestion | undefined> {
    const [updated] = await db.update(cardQuestions).set(updates).where(eq(cardQuestions.id, id)).returning();
    return updated;
  }

  async deleteCardQuestion(id: string): Promise<boolean> {
    const result = await db.delete(cardQuestions).where(eq(cardQuestions.id, id));
    return true;
  }

  async getCardQuestionById(id: string): Promise<CardQuestion | undefined> {
    const [card] = await db.select().from(cardQuestions).where(eq(cardQuestions.id, id)).limit(1);
    return card;
  }

  async getSessionIcebreakerGame(sessionId: string, groupNumber: number): Promise<IcebreakerGame | undefined> {
    const [game] = await db.select().from(icebreakerGames)
      .where(and(
        eq(icebreakerGames.bibleStudySessionId, sessionId),
        eq(icebreakerGames.groupNumber, groupNumber),
        inArray(icebreakerGames.status, ['active', 'waiting'])
      ))
      .orderBy(icebreakerGames.createdAt)
      .limit(1);
    return game;
  }

  async drawIcebreakerCard(gameId: string, level: string): Promise<{ cardId: string | null; cardContent: string | null; cardLevel: string; cardsRemaining: number }> {
    // Get current game to check usedCardIds
    const [game] = await db.select().from(icebreakerGames).where(eq(icebreakerGames.id, gameId)).limit(1);
    const usedCardIds = (game?.usedCardIds as string[]) || [];
    
    // Get all active cards for this level
    const allCards = await db.select().from(cardQuestions)
      .where(and(eq(cardQuestions.level, level), eq(cardQuestions.isActive, true)));
    
    // Filter out already-drawn cards
    const availableCards = allCards.filter(card => !usedCardIds.includes(card.id));
    
    if (availableCards.length === 0) {
      return { cardId: null, cardContent: null, cardLevel: level, cardsRemaining: 0 };
    }
    
    // Pick a random card from available ones
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    
    // Update game with new usedCardIds
    const newUsedCardIds = [...usedCardIds, randomCard.id];
    await db.update(icebreakerGames)
      .set({ 
        currentCardId: randomCard.id, 
        currentLevel: level, 
        usedCardIds: newUsedCardIds,
        updatedAt: new Date() 
      })
      .where(eq(icebreakerGames.id, gameId));
    
    return { 
      cardId: randomCard.id, 
      cardContent: randomCard.contentText, 
      cardLevel: level, 
      cardsRemaining: availableCards.length - 1 
    };
  }

  async resetIcebreakerDeck(gameId: string): Promise<void> {
    await db.update(icebreakerGames)
      .set({ currentCardId: null, passCount: 0, usedCardIds: [], updatedAt: new Date() })
      .where(eq(icebreakerGames.id, gameId));
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

  async getMessageCardById(id: string): Promise<MessageCard | undefined> {
    const [card] = await db.select().from(messageCards).where(eq(messageCards.id, id)).limit(1);
    return card;
  }

  async updateMessageCard(id: string, data: Partial<{ title: string; imagePath: string; isActive: boolean }>): Promise<MessageCard | undefined> {
    const [updated] = await db.update(messageCards).set(data).where(eq(messageCards.id, id)).returning();
    return updated;
  }

  async deleteMessageCard(id: string): Promise<void> {
    await db.delete(messageCards).where(eq(messageCards.id, id));
  }

  async getMessageCardDownloads(): Promise<MessageCardDownload[]> {
    return db.select().from(messageCardDownloads).orderBy(desc(messageCardDownloads.downloadedAt));
  }

  async getMessageCardDownloadsByCardId(cardId: string): Promise<MessageCardDownload[]> {
    return db.select().from(messageCardDownloads).where(eq(messageCardDownloads.cardId, cardId)).orderBy(desc(messageCardDownloads.downloadedAt));
  }

  async deleteAiReport(id: string): Promise<void> {
    await db.delete(aiReports).where(eq(aiReports.id, id));
  }

  async getGroupingActivities(): Promise<GroupingActivity[]> {
    return db.select().from(groupingActivities).orderBy(desc(groupingActivities.createdAt));
  }

  async getGroupingActivity(id: string): Promise<GroupingActivity | undefined> {
    const [activity] = await db.select().from(groupingActivities).where(eq(groupingActivities.id, id)).limit(1);
    return activity;
  }

  async getGroupingActivityByCode(shortCode: string): Promise<GroupingActivity | undefined> {
    const [activity] = await db.select().from(groupingActivities)
      .where(and(eq(groupingActivities.shortCode, shortCode.toUpperCase()), eq(groupingActivities.status, 'joining')))
      .limit(1);
    return activity;
  }

  async getActiveGroupingActivitiesByOwner(ownerId: string): Promise<GroupingActivity[]> {
    return db.select().from(groupingActivities)
      .where(and(eq(groupingActivities.ownerId, ownerId), eq(groupingActivities.status, 'joining')));
  }

  async generateUniqueShortCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
    let code: string = '';
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await db.select().from(groupingActivities)
        .where(eq(groupingActivities.shortCode, code))
        .limit(1);
      if (existing.length === 0) {
        return code;
      }
      attempts++;
    }
    
    throw new Error('Failed to generate unique short code after maximum attempts');
  }

  async createGroupingActivity(activity: InsertGroupingActivity): Promise<GroupingActivity> {
    const [newActivity] = await db.insert(groupingActivities).values(activity).returning();
    return newActivity;
  }

  async updateGroupingActivity(id: string, data: Partial<GroupingActivity>): Promise<GroupingActivity | undefined> {
    const [updated] = await db.update(groupingActivities).set(data).where(eq(groupingActivities.id, id)).returning();
    return updated;
  }

  async getGroupingParticipants(activityId: string): Promise<GroupingParticipant[]> {
    return db.select().from(groupingParticipants).where(eq(groupingParticipants.activityId, activityId)).orderBy(asc(groupingParticipants.joinedAt));
  }

  async addGroupingParticipant(participant: InsertGroupingParticipant): Promise<GroupingParticipant> {
    const [newParticipant] = await db.insert(groupingParticipants).values(participant).returning();
    return newParticipant;
  }

  async updateGroupingParticipants(activityId: string, updates: { id: string; groupNumber: number }[]): Promise<void> {
    for (const update of updates) {
      await db.update(groupingParticipants)
        .set({ groupNumber: update.groupNumber })
        .where(and(eq(groupingParticipants.id, update.id), eq(groupingParticipants.activityId, activityId)));
    }
  }

  async deleteGroupingActivity(id: string): Promise<void> {
    await db.delete(groupingParticipants).where(eq(groupingParticipants.activityId, id));
    await db.delete(groupingActivities).where(eq(groupingActivities.id, id));
  }

  // Prayer Meeting methods
  async getPrayerMeetings(): Promise<PrayerMeeting[]> {
    return db.select().from(prayerMeetings).orderBy(desc(prayerMeetings.createdAt));
  }

  async getPrayerMeeting(id: string): Promise<PrayerMeeting | undefined> {
    const [meeting] = await db.select().from(prayerMeetings).where(eq(prayerMeetings.id, id)).limit(1);
    return meeting;
  }

  async getPrayerMeetingByCode(shortCode: string): Promise<PrayerMeeting | undefined> {
    const [meeting] = await db.select().from(prayerMeetings)
      .where(eq(prayerMeetings.shortCode, shortCode.toUpperCase()))
      .limit(1);
    return meeting;
  }

  async getActivePrayerMeetingsByOwner(ownerId: string): Promise<PrayerMeeting[]> {
    return db.select().from(prayerMeetings)
      .where(and(eq(prayerMeetings.ownerId, ownerId), sql`${prayerMeetings.status} != 'completed'`))
      .orderBy(desc(prayerMeetings.createdAt));
  }

  async getClosedPrayerMeetings(): Promise<PrayerMeeting[]> {
    return db.select().from(prayerMeetings)
      .where(or(eq(prayerMeetings.status, 'closed'), eq(prayerMeetings.status, 'completed')))
      .orderBy(desc(prayerMeetings.createdAt));
  }

  async createPrayerMeeting(meeting: InsertPrayerMeeting): Promise<PrayerMeeting> {
    const [newMeeting] = await db.insert(prayerMeetings).values(meeting).returning();
    return newMeeting;
  }

  async updatePrayerMeeting(id: string, data: Partial<PrayerMeeting>): Promise<PrayerMeeting | undefined> {
    const [updated] = await db.update(prayerMeetings).set(data).where(eq(prayerMeetings.id, id)).returning();
    return updated;
  }

  async updatePrayerMeetingStatus(id: string, status: string): Promise<PrayerMeeting | undefined> {
    const [updated] = await db.update(prayerMeetings)
      .set({ status })
      .where(eq(prayerMeetings.id, id))
      .returning();
    return updated;
  }

  async deletePrayerMeeting(id: string): Promise<void> {
    await db.delete(prayerMeetingParticipants).where(eq(prayerMeetingParticipants.meetingId, id));
    await db.delete(prayerMeetings).where(eq(prayerMeetings.id, id));
  }

  async getPrayerMeetingParticipants(meetingId: string): Promise<PrayerMeetingParticipant[]> {
    return db.select().from(prayerMeetingParticipants)
      .where(eq(prayerMeetingParticipants.meetingId, meetingId))
      .orderBy(asc(prayerMeetingParticipants.joinedAt));
  }

  async getPrayerMeetingParticipantById(id: string): Promise<PrayerMeetingParticipant | undefined> {
    const [participant] = await db.select().from(prayerMeetingParticipants)
      .where(eq(prayerMeetingParticipants.id, id));
    return participant;
  }

  async addPrayerMeetingParticipant(participant: InsertPrayerMeetingParticipant): Promise<PrayerMeetingParticipant> {
    const [newParticipant] = await db.insert(prayerMeetingParticipants).values(participant).returning();
    return newParticipant;
  }

  async updatePrayerMeetingParticipant(id: string, data: Partial<PrayerMeetingParticipant>): Promise<PrayerMeetingParticipant | undefined> {
    const [updated] = await db.update(prayerMeetingParticipants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(prayerMeetingParticipants.id, id))
      .returning();
    return updated;
  }

  async updatePrayerMeetingParticipants(meetingId: string, updates: { id: string; groupNumber: number }[]): Promise<void> {
    for (const update of updates) {
      await db.update(prayerMeetingParticipants)
        .set({ groupNumber: update.groupNumber, updatedAt: new Date() })
        .where(and(eq(prayerMeetingParticipants.id, update.id), eq(prayerMeetingParticipants.meetingId, meetingId)));
    }
  }

  async generateUniquePrayerMeetingCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let exists = true;
    
    while (exists) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await db.select().from(prayerMeetings)
        .where(eq(prayerMeetings.shortCode, code)).limit(1);
      exists = existing.length > 0;
    }
    
    return code!;
  }

  async getBibleBooks(): Promise<{ bookName: string; bookNumber: number; chapterCount: number }[]> {
    const cacheKey = cacheKeys.bibleBooks();
    const cached = bibleCache.get<{ bookName: string; bookNumber: number; chapterCount: number }[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const result = await db
      .select({
        bookName: chineseUnionTrad.bookName,
        bookNumber: chineseUnionTrad.bookNumber,
        chapterCount: sql<number>`MAX(${chineseUnionTrad.chapter})`.as('chapterCount'),
      })
      .from(chineseUnionTrad)
      .groupBy(chineseUnionTrad.bookName, chineseUnionTrad.bookNumber)
      .orderBy(asc(chineseUnionTrad.bookNumber));
    
    // Only cache non-empty results
    if (result.length > 0) {
      bibleCache.set(cacheKey, result);
    }
    return result;
  }

  async getBibleChapters(bookName: string): Promise<{ chapter: number; verseCount: number }[]> {
    const cacheKey = cacheKeys.bibleChapters(bookName);
    const cached = bibleCache.get<{ chapter: number; verseCount: number }[]>(cacheKey);
    if (cached) return cached;

    const result = await db
      .select({
        chapter: chineseUnionTrad.chapter,
        verseCount: sql<number>`MAX(${chineseUnionTrad.verse})`.as('verseCount'),
      })
      .from(chineseUnionTrad)
      .where(eq(chineseUnionTrad.bookName, bookName))
      .groupBy(chineseUnionTrad.chapter)
      .orderBy(asc(chineseUnionTrad.chapter));
    
    bibleCache.set(cacheKey, result);
    return result;
  }

  async getBibleVerses(bookName: string, chapter: number): Promise<ChineseUnionTrad[]> {
    const cacheKey = cacheKeys.bibleVerses(bookName, chapter);
    const cached = bibleCache.get<ChineseUnionTrad[]>(cacheKey);
    if (cached) return cached;

    const result = await db
      .select()
      .from(chineseUnionTrad)
      .where(and(eq(chineseUnionTrad.bookName, bookName), eq(chineseUnionTrad.chapter, chapter)))
      .orderBy(asc(chineseUnionTrad.verse));
    
    bibleCache.set(cacheKey, result);
    return result;
  }

  async searchBibleVerses(query: string, limit = 50): Promise<ChineseUnionTrad[]> {
    const normalizedQuery = query.replace(/\s+/g, '');
    return db
      .select()
      .from(chineseUnionTrad)
      .where(sql`REPLACE(${chineseUnionTrad.text}, ' ', '') LIKE ${'%' + normalizedQuery + '%'}`)
      .limit(limit);
  }

  async getBlessingVerses(type?: string): Promise<BlessingVerse[]> {
    if (type) {
      return db.select().from(blessingVerses).where(eq(blessingVerses.blessingType, type));
    }
    return db.select().from(blessingVerses);
  }

  async getRandomBlessingVerse(): Promise<BlessingVerse | undefined> {
    const [verse] = await db.select().from(blessingVerses).orderBy(sql`RANDOM()`).limit(1);
    return verse;
  }

  async getJesus4Seasons(): Promise<Jesus4Season[]> {
    const cacheKey = cacheKeys.timelineSeasons();
    const cached = timelineCache.get<Jesus4Season[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const result = await db.select().from(jesus4Seasons).orderBy(asc(jesus4Seasons.displayOrder));
    // Only cache non-empty results
    if (result.length > 0) {
      timelineCache.set(cacheKey, result);
    }
    return result;
  }

  async getJesus4SeasonsBySeason(season: string): Promise<Jesus4Season[]> {
    const cacheKey = cacheKeys.timelineEvents(season);
    const cached = timelineCache.get<Jesus4Season[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const result = await db.select().from(jesus4Seasons).where(eq(jesus4Seasons.season, season)).orderBy(asc(jesus4Seasons.displayOrder));
    // Only cache non-empty results
    if (result.length > 0) {
      timelineCache.set(cacheKey, result);
    }
    return result;
  }

  async getJesusDailyContent(season?: string): Promise<JesusDailyContent[]> {
    if (season) {
      return db.select().from(jesusDailyContent).where(eq(jesusDailyContent.season, season));
    }
    return db.select().from(jesusDailyContent);
  }

  async getReadingPlanTemplates(): Promise<ReadingPlanTemplate[]> {
    return db.select().from(readingPlanTemplates).orderBy(asc(readingPlanTemplates.name));
  }

  async getReadingPlanTemplate(id: string): Promise<ReadingPlanTemplate | undefined> {
    const [template] = await db.select().from(readingPlanTemplates).where(eq(readingPlanTemplates.id, id)).limit(1);
    return template;
  }

  async getReadingPlanItems(templateId: string): Promise<ReadingPlanTemplateItem[]> {
    return db.select().from(readingPlanTemplateItems).where(eq(readingPlanTemplateItems.templateId, templateId)).orderBy(asc(readingPlanTemplateItems.dayNumber));
  }

  async getSavedVerses(userId: string): Promise<SavedVerse[]> {
    return db.select().from(savedVerses).where(eq(savedVerses.userId, userId)).orderBy(desc(savedVerses.createdAt));
  }

  async getSavedVerse(userId: string, bookName: string, chapter: number, verse: number): Promise<SavedVerse | undefined> {
    const [saved] = await db.select().from(savedVerses).where(
      and(
        eq(savedVerses.userId, userId),
        eq(savedVerses.bookName, bookName),
        eq(savedVerses.chapter, chapter),
        eq(savedVerses.verseStart, verse)
      )
    ).limit(1);
    return saved;
  }

  async createSavedVerse(data: InsertSavedVerse): Promise<SavedVerse> {
    const [saved] = await db.insert(savedVerses).values(data).returning();
    return saved;
  }

  async deleteSavedVerse(id: string): Promise<void> {
    await db.delete(savedVerses).where(eq(savedVerses.id, id));
  }

  async getUserReadingPlans(userId: string): Promise<UserReadingPlan[]> {
    return db.select().from(userReadingPlans).where(eq(userReadingPlans.userId, userId)).orderBy(desc(userReadingPlans.createdAt));
  }

  async getUserReadingPlan(id: string): Promise<UserReadingPlan | undefined> {
    const [plan] = await db.select().from(userReadingPlans).where(eq(userReadingPlans.id, id)).limit(1);
    return plan;
  }

  async createUserReadingPlan(plan: InsertUserReadingPlan): Promise<UserReadingPlan> {
    const [created] = await db.insert(userReadingPlans).values(plan).returning();
    return created;
  }

  async updateUserReadingPlan(id: string, updates: Partial<InsertUserReadingPlan>): Promise<UserReadingPlan | undefined> {
    const [updated] = await db.update(userReadingPlans).set({ ...updates, updatedAt: new Date() }).where(eq(userReadingPlans.id, id)).returning();
    return updated;
  }

  async deleteUserReadingPlan(id: string): Promise<void> {
    await db.delete(devotionalNotes).where(eq(devotionalNotes.readingPlanId, id));
    await db.delete(userReadingProgress).where(eq(userReadingProgress.planId, id));
    await db.delete(userReadingPlans).where(eq(userReadingPlans.id, id));
  }

  async getUserReadingProgress(planId: string): Promise<UserReadingProgress[]> {
    return db.select().from(userReadingProgress).where(eq(userReadingProgress.planId, planId)).orderBy(asc(userReadingProgress.dayNumber));
  }

  async getUserTodayProgress(userId: string): Promise<UserReadingProgress[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(userReadingProgress).where(
      and(
        eq(userReadingProgress.userId, userId),
        eq(userReadingProgress.readingDate, today)
      )
    );
  }

  async markReadingComplete(id: string): Promise<UserReadingProgress | undefined> {
    const [updated] = await db.update(userReadingProgress).set({
      isCompleted: true,
      completedAt: new Date(),
    }).where(eq(userReadingProgress.id, id)).returning();
    return updated;
  }

  async createReadingProgress(progress: InsertUserReadingProgress): Promise<UserReadingProgress> {
    const [created] = await db.insert(userReadingProgress).values(progress).returning();
    return created;
  }

  async getDevotionalNote(id: string): Promise<DevotionalNote | undefined> {
    const [note] = await db.select().from(devotionalNotes).where(eq(devotionalNotes.id, id)).limit(1);
    return note;
  }

  async getDevotionalNotes(userId: string): Promise<DevotionalNote[]> {
    return db.select().from(devotionalNotes).where(and(eq(devotionalNotes.userId, userId), eq(devotionalNotes.hidden, false))).orderBy(desc(devotionalNotes.createdAt));
  }

  async toggleDevotionalNoteHidden(id: string, hidden: boolean): Promise<DevotionalNote | undefined> {
    const [updated] = await db.update(devotionalNotes).set({ hidden, updatedAt: new Date() }).where(eq(devotionalNotes.id, id)).returning();
    return updated;
  }

  async getDevotionalNoteByPlanDay(planId: string, dayNumber: number): Promise<DevotionalNote | undefined> {
    const [note] = await db.select().from(devotionalNotes).where(
      and(
        eq(devotionalNotes.readingPlanId, planId),
        eq(devotionalNotes.dayNumber, dayNumber)
      )
    ).limit(1);
    return note;
  }

  async createDevotionalNote(note: InsertDevotionalNote): Promise<DevotionalNote> {
    const [created] = await db.insert(devotionalNotes).values(note).returning();
    return created;
  }

  async updateDevotionalNote(id: string, updates: Partial<InsertDevotionalNote>): Promise<DevotionalNote | undefined> {
    const [updated] = await db.update(devotionalNotes).set({ ...updates, updatedAt: new Date() }).where(eq(devotionalNotes.id, id)).returning();
    return updated;
  }

  async getDevotionalNoteByVerseReference(userId: string, verseReference: string): Promise<DevotionalNote | undefined> {
    const [note] = await db.select().from(devotionalNotes).where(
      and(
        eq(devotionalNotes.userId, userId),
        eq(devotionalNotes.verseReference, verseReference),
        isNull(devotionalNotes.readingPlanId)
      )
    ).orderBy(desc(devotionalNotes.updatedAt)).limit(1);
    return note;
  }

  async createReadingPlanTemplate(template: InsertReadingPlanTemplate): Promise<ReadingPlanTemplate> {
    const [created] = await db.insert(readingPlanTemplates).values(template).returning();
    return created;
  }

  async createReadingPlanTemplateItems(items: Array<{templateId: string, dayNumber: number, bookName?: string, chapterStart?: number, chapterEnd?: number, scriptureReference?: string}>): Promise<void> {
    if (items.length === 0) return;
    await db.insert(readingPlanTemplateItems).values(items);
  }

  async getInboxEmails(options?: { archived?: boolean; limit?: number; offset?: number }): Promise<InboxEmail[]> {
    const archived = options?.archived ?? false;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    return db.select().from(inboxEmails)
      .where(eq(inboxEmails.isArchived, archived))
      .orderBy(desc(inboxEmails.receivedAt))
      .limit(limit)
      .offset(offset);
  }

  async getInboxEmail(id: number): Promise<InboxEmail | undefined> {
    const [email] = await db.select().from(inboxEmails).where(eq(inboxEmails.id, id)).limit(1);
    return email;
  }

  async createInboxEmail(email: InsertInboxEmail): Promise<InboxEmail> {
    const [created] = await db.insert(inboxEmails).values(email).returning();
    return created;
  }

  async markInboxEmailRead(id: number, isRead: boolean): Promise<InboxEmail | undefined> {
    const [updated] = await db.update(inboxEmails).set({ isRead }).where(eq(inboxEmails.id, id)).returning();
    return updated;
  }

  async archiveInboxEmail(id: number, isArchived: boolean): Promise<InboxEmail | undefined> {
    const [updated] = await db.update(inboxEmails).set({ isArchived }).where(eq(inboxEmails.id, id)).returning();
    return updated;
  }

  async getInboxUnreadCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(inboxEmails)
      .where(and(eq(inboxEmails.isRead, false), eq(inboxEmails.isArchived, false)));
    return result[0]?.count ?? 0;
  }
}

export const storage = new DatabaseStorage();
