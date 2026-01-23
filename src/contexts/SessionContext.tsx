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
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  
  // Submissions
  submissions: StudySubmission[];
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

  const removeUser = useCallback((userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  const addSubmission = useCallback((submission: StudySubmission) => {
    setSubmissions(prev => [...prev, submission]);
  }, []);

  const assignGroups = useCallback((settings: GroupingSettings) => {
    const { groupSize, method } = settings;
    let usersToGroup = [...users];
    
    if (method === 'gender-balanced') {
      const males = usersToGroup.filter(u => u.gender === 'male');
      const females = usersToGroup.filter(u => u.gender === 'female');
      usersToGroup = [];
      const maxLen = Math.max(males.length, females.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < males.length) usersToGroup.push(males[i]);
        if (i < females.length) usersToGroup.push(females[i]);
      }
    } else {
      // Random shuffle
      for (let i = usersToGroup.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [usersToGroup[i], usersToGroup[j]] = [usersToGroup[j], usersToGroup[i]];
      }
    }
    
    const groups: Group[] = [];
    let groupNumber = 1;
    
    for (let i = 0; i < usersToGroup.length; i += groupSize) {
      const groupMembers = usersToGroup.slice(i, i + groupSize);
      groupMembers.forEach(member => {
        member.groupNumber = groupNumber;
      });
      groups.push({
        id: `group-${groupNumber}`,
        number: groupNumber,
        members: groupMembers,
      });
      groupNumber++;
    }
    
    setUsers([...usersToGroup]);
    setCurrentSession(prev => prev ? { ...prev, groups, status: 'studying' } : null);
  }, [users]);

  return (
    <SessionContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentSession,
        setCurrentSession,
        users,
        addUser,
        removeUser,
        submissions,
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
