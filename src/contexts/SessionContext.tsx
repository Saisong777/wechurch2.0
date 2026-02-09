import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Session, StudySubmission } from '@/types/bible-study';

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
