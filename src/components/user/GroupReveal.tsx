import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';

interface GroupRevealProps {
  onContinue: () => void;
}

// Group color palette - distinct, easy-to-identify colors
const GROUP_COLORS = [
  { bg: 'from-red-500 to-red-600', glow: 'bg-red-500/40', text: 'text-white' },           // Group 1 - Red
  { bg: 'from-blue-500 to-blue-600', glow: 'bg-blue-500/40', text: 'text-white' },         // Group 2 - Blue
  { bg: 'from-green-500 to-green-600', glow: 'bg-green-500/40', text: 'text-white' },      // Group 3 - Green
  { bg: 'from-yellow-400 to-yellow-500', glow: 'bg-yellow-400/40', text: 'text-black' },   // Group 4 - Yellow
  { bg: 'from-purple-500 to-purple-600', glow: 'bg-purple-500/40', text: 'text-white' },   // Group 5 - Purple
  { bg: 'from-orange-500 to-orange-600', glow: 'bg-orange-500/40', text: 'text-white' },   // Group 6 - Orange
  { bg: 'from-pink-500 to-pink-600', glow: 'bg-pink-500/40', text: 'text-white' },         // Group 7 - Pink
  { bg: 'from-cyan-500 to-cyan-600', glow: 'bg-cyan-500/40', text: 'text-white' },         // Group 8 - Cyan
  { bg: 'from-indigo-500 to-indigo-600', glow: 'bg-indigo-500/40', text: 'text-white' },   // Group 9 - Indigo
  { bg: 'from-teal-500 to-teal-600', glow: 'bg-teal-500/40', text: 'text-white' },         // Group 10 - Teal
];

function getGroupColor(groupNumber: number) {
  // Use modulo to cycle through colors for groups > 10
  const colorIndex = ((groupNumber - 1) % GROUP_COLORS.length);
  return GROUP_COLORS[colorIndex];
}

export const GroupReveal: React.FC<GroupRevealProps> = ({ onContinue }) => {
  const { currentUser, currentSession, users } = useSession();
  const [showNumber, setShowNumber] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Reveal animation sequence
    const timer1 = setTimeout(() => setShowNumber(true), 500);
    const timer2 = setTimeout(() => setShowDetails(true), 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const globalGroupNumber = currentUser?.groupNumber || 1;
  const userLocation = currentUser?.location || 'On-site';

  // Calculate local group number within the user's location
  const localGroupInfo = useMemo(() => {
    // If no groups data available, fall back to global group number
    if (!currentSession?.groups || currentSession.groups.length === 0) {
      return { localNumber: globalGroupNumber, totalGroupsInLocation: 1 };
    }

    // Get all groups in the user's location
    const locationGroups = currentSession.groups
      .filter(g => {
        // Safely check if group has members before accessing location
        if (!g.members || g.members.length === 0) return false;
        const groupLocation = g.members[0]?.location || 'On-site';
        return groupLocation === userLocation;
      })
      .sort((a, b) => a.number - b.number);

    // If no groups found in location, fall back to global number
    if (locationGroups.length === 0) {
      return { localNumber: globalGroupNumber, totalGroupsInLocation: 1 };
    }

    // Find the local index of the user's group within their location
    const localIndex = locationGroups.findIndex(g => g.number === globalGroupNumber);
    const localNumber = localIndex >= 0 ? localIndex + 1 : globalGroupNumber;

    return {
      localNumber,
      totalGroupsInLocation: locationGroups.length,
    };
  }, [currentSession?.groups, currentUser?.groupNumber, globalGroupNumber, userLocation]);

  const { localNumber } = localGroupInfo;
  const isRemote = userLocation !== 'On-site';
  
  // Get color based on local group number
  const groupColor = getGroupColor(localNumber);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center">
        {!showNumber && (
          <div className="animate-pulse">
            <p className="text-muted-foreground text-lg">正在分組中...</p>
            <p className="text-muted-foreground text-sm mt-2">Assigning groups...</p>
          </div>
        )}
        
        {showNumber && (
          <div className="animate-scale-in">
            {/* Show location if remote */}
            {isRemote && (
              <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{userLocation}</span>
              </div>
            )}
            
            <p className="text-muted-foreground text-lg mb-4">您的小組</p>
            
            <div className="relative inline-block">
              <div className={`absolute inset-0 ${groupColor.glow} rounded-full blur-3xl animate-pulse-soft`} />
              <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br ${groupColor.bg} flex items-center justify-center shadow-2xl`}>
                <span className={`font-serif text-8xl md:text-9xl font-bold ${groupColor.text} drop-shadow-lg`}>
                  {localNumber}
                </span>
              </div>
            </div>
            
            <p className="mt-6 font-serif text-3xl md:text-4xl font-bold text-foreground">
              第 {localNumber} 組
            </p>
            <p className="text-muted-foreground mt-2">
              {isRemote ? `${userLocation} - Group #${localNumber}` : `Group #${localNumber}`}
            </p>
          </div>
        )}
        
        {showDetails && (
          <div className="mt-12 animate-fade-in space-y-4">
            <p className="text-lg text-muted-foreground">
              {isRemote ? '請與您的線上小組成員會合' : '請移動至您的小組座位區'}
            </p>
            <p className="text-muted-foreground">
              {isRemote ? 'Please join your online group members' : 'Please move to your group seating area'}
            </p>
            
            <Button
              variant="gold"
              size="xl"
              onClick={onContinue}
              className="mt-8"
            >
              開始查經 Start Study
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
