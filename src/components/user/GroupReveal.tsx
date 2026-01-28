import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';
import { staggeredStart } from '@/lib/retry-utils';

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
  const [isReady, setIsReady] = useState(false);
  const initRef = useRef(false);

  // High-concurrency optimization: stagger initial animation to prevent
  // 500 users triggering animations at the exact same millisecond
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      // Random 0-1s stagger to spread out animation triggers
      await staggeredStart(1000);
      setIsReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    // Only start animation sequence after staggered initialization
    if (!isReady) return;

    // Reveal animation sequence
    const timer1 = setTimeout(() => setShowNumber(true), 500);
    const timer2 = setTimeout(() => setShowDetails(true), 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isReady]);

  // CRITICAL: Use the actual database group number - never default to 1
  // This was causing all users to appear in group 1
  const globalGroupNumber = currentUser?.groupNumber;
  const userLocation = currentUser?.location || 'On-site';

  // Calculate local group number within the user's location (for display only)
  const localGroupInfo = useMemo(() => {
    // If no group number assigned yet, return undefined - don't fake it
    if (!globalGroupNumber) {
      return { localNumber: undefined, totalGroupsInLocation: 0 };
    }

    // If no groups data available, use the actual global group number
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

    // If no groups found in location, use actual global number (don't default to 1!)
    if (locationGroups.length === 0) {
      return { localNumber: globalGroupNumber, totalGroupsInLocation: 1 };
    }

    // Find the local index of the user's group within their location
    const localIndex = locationGroups.findIndex(g => g.number === globalGroupNumber);
    // If not found in location groups, use the global number (not 1!)
    const localNumber = localIndex >= 0 ? localIndex + 1 : globalGroupNumber;

    return {
      localNumber,
      totalGroupsInLocation: locationGroups.length,
    };
  }, [currentSession?.groups, globalGroupNumber, userLocation]);

  const { localNumber } = localGroupInfo;
  const isRemote = userLocation !== 'On-site';
  
  // Get color based on local group number (use 1 only for color if undefined)
  const groupColor = getGroupColor(localNumber || 1);
  
  // Show loading state if group number not yet assigned
  if (!localNumber) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="animate-pulse text-center">
          <p className="text-muted-foreground text-lg sm:text-lg">正在取得分組資訊...</p>
          <p className="text-muted-foreground text-base sm:text-sm mt-2">Loading group assignment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="text-center">
        {!showNumber && (
          <div className="animate-pulse">
            <p className="text-muted-foreground text-lg sm:text-lg">正在分組中...</p>
            <p className="text-muted-foreground text-base sm:text-sm mt-2">Assigning groups...</p>
          </div>
        )}
        
        {showNumber && (
          <div className="animate-scale-in">
            {/* Show location if remote */}
            {isRemote && (
              <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground text-lg sm:text-base">
                <MapPin className="w-5 h-5 sm:w-4 sm:h-4" />
                <span>{userLocation}</span>
              </div>
            )}
            
            <p className="text-muted-foreground text-lg sm:text-lg mb-4">您的小組</p>
            
            <div className="relative inline-block">
              <div className={`absolute inset-0 ${groupColor.glow} rounded-full blur-3xl animate-pulse-soft`} />
              <div className={`relative w-52 h-52 sm:w-48 sm:h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br ${groupColor.bg} flex items-center justify-center shadow-2xl`}>
                <span className={`font-serif text-8xl sm:text-8xl md:text-9xl font-bold ${groupColor.text} drop-shadow-lg`}>
                  {localNumber}
                </span>
              </div>
            </div>
            
            <p className="mt-6 sm:mt-6 font-serif text-3xl sm:text-3xl md:text-4xl font-bold text-foreground">
              第 {localNumber} 組
            </p>
            <p className="text-base sm:text-base text-muted-foreground mt-2">
              {isRemote ? `${userLocation} - Group #${localNumber}` : `Group #${localNumber}`}
            </p>
          </div>
        )}
        
        {showDetails && (
          <div className="mt-10 sm:mt-12 animate-fade-in space-y-4">
            <p className="text-lg sm:text-lg text-muted-foreground">
              {isRemote ? '請與您的線上小組成員會合' : '請移動至您的小組座位區'}
            </p>
            <p className="text-base sm:text-base text-muted-foreground">
              {isRemote ? 'Please join your online group members' : 'Please move to your group seating area'}
            </p>
            
            <Button
              variant="gold"
              size="xl"
              onClick={onContinue}
              className="mt-8 w-full sm:w-auto h-14 sm:h-12 text-lg sm:text-base touch-manipulation active:scale-[0.98]"
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
