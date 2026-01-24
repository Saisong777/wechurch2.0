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

  /**
   * Calculate optimal group sizes: prioritize minSize, expand to maxSize only when needed
   */
  const calculateOptimalGroupSizes = (total: number, minSize: number, maxSize: number): number[] => {
    // Calculate how many groups at minSize, and what's left over
    const groupsAtMin = Math.floor(total / minSize);
    const remainder = total % minSize;
    
    if (remainder === 0) {
      // Perfect fit at minSize
      return Array(groupsAtMin).fill(minSize);
    }
    
    // We have a remainder. Options:
    // 1. Distribute remainder across existing groups (if they can absorb it)
    // 2. Create one more smaller group (if it meets minSize)
    
    const canAbsorb = groupsAtMin * (maxSize - minSize) >= remainder;
    
    if (canAbsorb && groupsAtMin > 0) {
      // Distribute remainder across groups, starting from the first
      const sizes = Array(groupsAtMin).fill(minSize);
      for (let i = 0; i < remainder; i++) {
        sizes[i % groupsAtMin]++;
      }
      return sizes;
    } else if (remainder >= minSize) {
      // Remainder is large enough to be its own group
      return [...Array(groupsAtMin).fill(minSize), remainder];
    } else if (groupsAtMin > 0) {
      // Remainder too small - reduce one group and redistribute
      const newTotal = total;
      const newGroupCount = groupsAtMin; // Keep same count, just redistribute
      const baseSize = Math.floor(newTotal / newGroupCount);
      const extra = newTotal % newGroupCount;
      const sizes: number[] = [];
      for (let i = 0; i < newGroupCount; i++) {
        sizes.push(baseSize + (i < extra ? 1 : 0));
      }
      return sizes;
    } else {
      // Edge case: total < minSize, just return one group
      return [total];
    }
  };

  const assignGroups = useCallback((settings: GroupingSettings) => {
    const { method, minSize, maxSize } = settings;
    
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

      const totalUsers = usersToGroup.length;
      
      // Edge case: fewer users than maxSize - put them all in one group
      if (totalUsers <= maxSize) {
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
        continue;
      }

      // Calculate optimal distribution: prioritize minSize, expand only when needed
      const groupSizes = calculateOptimalGroupSizes(totalUsers, minSize, maxSize);
      
      let currentIndex = 0;
      for (const size of groupSizes) {
        const groupMembers = usersToGroup.slice(currentIndex, currentIndex + size);
        currentIndex += size;
        
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
