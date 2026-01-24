import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Session, StudySubmission, GroupingSettings, Group } from '@/types/bible-study';

interface SessionContextType {
  // Current user state
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  // Session state
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;
  
  // Users in session
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  removeUser: (userId: string) => void;
  
  // Submissions
  submissions: StudySubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<StudySubmission[]>>;
  addSubmission: (submission: StudySubmission) => void;
  
  // Grouping
  assignGroups: (settings: GroupingSettings) => void;
  
  // Admin state
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<StudySubmission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const addUser = useCallback((user: User) => {
    setUsers(prev => {
      if (prev.find(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  const updateUser = useCallback((user: User) => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  }, []);

  const removeUser = useCallback((userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  const addSubmission = useCallback((submission: StudySubmission) => {
    setSubmissions(prev => {
      if (prev.find(s => s.id === submission.id)) return prev;
      return [...prev, submission];
    });
  }, []);

  // Helper: Shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Helper: Gender balancing
  const applyGenderBalancing = (usersArr: User[]): User[] => {
    const males = usersArr.filter(u => u.gender === 'male');
    const females = usersArr.filter(u => u.gender === 'female');
    const balanced: User[] = [];
    const maxLen = Math.max(males.length, females.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < males.length) balanced.push(males[i]);
      if (i < females.length) balanced.push(females[i]);
    }
    return balanced;
  };

  const assignGroups = useCallback((settings: GroupingSettings) => {
    const { method } = settings;
    const MAX_GROUP_SIZE = 6;
    
    // Step 1: Bucket participants by location (STRICT ISOLATION)
    const locationBuckets = new Map<string, User[]>();
    for (const user of users) {
      const loc = user.location || 'On-site';
      if (!locationBuckets.has(loc)) {
        locationBuckets.set(loc, []);
      }
      locationBuckets.get(loc)!.push(user);
    }

    const groups: Group[] = [];
    let groupNumber = 1;
    const updatedUsers: User[] = [];

    // Step 2: Process each location bucket independently (NO MIXING)
    for (const [, bucketUsers] of locationBuckets) {
      let usersToGroup = [...bucketUsers];
      
      // Apply grouping method
      if (method === 'gender-balanced') {
        usersToGroup = applyGenderBalancing(usersToGroup);
      } else {
        usersToGroup = shuffleArray(usersToGroup);
      }

      // Step 3: Split into subgroups with max 6 members
      if (usersToGroup.length <= MAX_GROUP_SIZE) {
        // Single group for this location
        usersToGroup.forEach(member => {
          member.groupNumber = groupNumber;
          updatedUsers.push(member);
        });
        groups.push({
          id: `group-${groupNumber}`,
          number: groupNumber,
          members: usersToGroup,
        });
        groupNumber++;
      } else {
        // Split into multiple subgroups - balance sizes
        const subgroupCount = Math.ceil(usersToGroup.length / MAX_GROUP_SIZE);
        const baseSize = Math.floor(usersToGroup.length / subgroupCount);
        const remainder = usersToGroup.length % subgroupCount;
        
        let currentIndex = 0;
        for (let subIdx = 0; subIdx < subgroupCount; subIdx++) {
          const thisGroupSize = baseSize + (subIdx < remainder ? 1 : 0);
          const groupMembers = usersToGroup.slice(currentIndex, currentIndex + thisGroupSize);
          currentIndex += thisGroupSize;
          
          groupMembers.forEach(member => {
            member.groupNumber = groupNumber;
            updatedUsers.push(member);
          });
          
          groups.push({
            id: `group-${groupNumber}`,
            number: groupNumber,
            members: groupMembers,
          });
          groupNumber++;
        }
      }
    }
    
    setUsers(updatedUsers);
    setCurrentSession(prev => prev ? { ...prev, groups, status: 'grouping' } : null);
  }, [users]);

  return (
    <SessionContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentSession,
        setCurrentSession,
        users,
        setUsers,
        addUser,
        updateUser,
        removeUser,
        submissions,
        setSubmissions,
        addSubmission,
        assignGroups,
        isAdmin,
        setIsAdmin,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
