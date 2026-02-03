import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Shuffle, Copy, Check, Users, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Person {
  name: string;
  gender: 'M' | 'F' | 'U';
}

interface Group {
  id: number;
  members: Person[];
}

type GroupingMode = 'bySize' | 'byCount';
type GenderMode = 'mixed' | 'split';

export const RandomGrouper = () => {
  const [namesInput, setNamesInput] = useState('');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('bySize');
  const [groupSize, setGroupSize] = useState(4);
  const [groupCount, setGroupCount] = useState(3);
  const [genderMode, setGenderMode] = useState<GenderMode>('mixed');
  const [groups, setGroups] = useState<Group[]>([]);
  const [copiedGroup, setCopiedGroup] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const parseNames = (input: string): Person[] => {
    return input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(/\s+/);
        const lastPart = parts[parts.length - 1]?.toUpperCase();
        
        let gender: 'M' | 'F' | 'U' = 'U';
        let name = line;
        
        if (lastPart === 'M' || lastPart === '男') {
          gender = 'M';
          name = parts.slice(0, -1).join(' ');
        } else if (lastPart === 'F' || lastPart === '女') {
          gender = 'F';
          name = parts.slice(0, -1).join(' ');
        }
        
        return { name: name.trim(), gender };
      })
      .filter(p => p.name.length > 0);
  };

  const people = useMemo(() => parseNames(namesInput), [namesInput]);

  const shuffle = <T,>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const createGroups = () => {
    if (people.length === 0) {
      toast.error('請先輸入名單');
      return;
    }

    const effectiveGroupCount = Math.min(groupCount, people.length);
    if (groupingMode === 'byCount' && groupCount > people.length) {
      toast.info(`人數不足，已調整為 ${effectiveGroupCount} 組`);
    }

    let result: Group[] = [];
    const shuffledPeople = shuffle(people);

    if (genderMode === 'split') {
      const males = shuffledPeople.filter(p => p.gender === 'M');
      const females = shuffledPeople.filter(p => p.gender === 'F');
      const unknowns = shuffledPeople.filter(p => p.gender === 'U');

      const createGroupsFromList = (list: Person[], startId: number): Group[] => {
        if (list.length === 0) return [];
        
        const numGroups = groupingMode === 'bySize' 
          ? Math.ceil(list.length / groupSize)
          : Math.min(effectiveGroupCount, list.length);
        
        const groups: Group[] = Array.from({ length: numGroups }, (_, i) => ({
          id: startId + i,
          members: []
        }));

        list.forEach((person, index) => {
          groups[index % numGroups].members.push(person);
        });

        return groups.filter(g => g.members.length > 0);
      };

      const maleGroups = createGroupsFromList(males, 1);
      const femaleGroups = createGroupsFromList(females, maleGroups.length + 1);
      const unknownGroups = unknowns.length > 0 
        ? createGroupsFromList(unknowns, maleGroups.length + femaleGroups.length + 1)
        : [];
      
      result = [...maleGroups, ...femaleGroups, ...unknownGroups];
    } else {
      const numGroups = groupingMode === 'bySize'
        ? Math.ceil(people.length / groupSize)
        : effectiveGroupCount;

      result = Array.from({ length: numGroups }, (_, i) => ({
        id: i + 1,
        members: []
      }));

      const males = shuffle(shuffledPeople.filter(p => p.gender === 'M'));
      const females = shuffle(shuffledPeople.filter(p => p.gender === 'F'));
      const unknowns = shuffle(shuffledPeople.filter(p => p.gender === 'U'));

      let allPeople: Person[] = [];
      const maxLen = Math.max(males.length, females.length, unknowns.length);
      
      for (let i = 0; i < maxLen; i++) {
        if (i < males.length) allPeople.push(males[i]);
        if (i < females.length) allPeople.push(females[i]);
        if (i < unknowns.length) allPeople.push(unknowns[i]);
      }

      allPeople.forEach((person, index) => {
        result[index % numGroups].members.push(person);
      });

      result = result.filter(g => g.members.length > 0);
    }

    result.forEach((g, i) => g.id = i + 1);
    setGroups(result);
    toast.success(`已分成 ${result.length} 組！`);
  };

  const copyGroup = (group: Group) => {
    const text = `第 ${group.id} 組：\n${group.members.map(m => m.name).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedGroup(group.id);
    toast.success(`已複製第 ${group.id} 組`);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const copyAllGroups = () => {
    const text = groups
      .map(g => `【第 ${g.id} 組】\n${g.members.map(m => m.name).join('\n')}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('已複製所有分組結果');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getGenderBadge = (gender: 'M' | 'F' | 'U') => {
    if (gender === 'M') return <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">男</Badge>;
    if (gender === 'F') return <Badge variant="outline" className="text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800">女</Badge>;
    return null;
  };

  const getGroupStats = (group: Group) => {
    const males = group.members.filter(m => m.gender === 'M').length;
    const females = group.members.filter(m => m.gender === 'F').length;
    return { males, females, total: group.members.length };
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          神的安排
        </h1>
        <p className="text-muted-foreground text-sm">快速隨機分組器</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            輸入名單
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              placeholder="請輸入名單，每行一人&#10;可選擇加註性別：&#10;王小明 男&#10;李小華 女&#10;張三"
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
              data-testid="input-names"
            />
            <p className="text-xs text-muted-foreground mt-2">
              已輸入 <span className="font-bold text-foreground">{people.length}</span> 人
              {people.filter(p => p.gender !== 'U').length > 0 && (
                <span className="ml-2">
                  (男 {people.filter(p => p.gender === 'M').length} / 女 {people.filter(p => p.gender === 'F').length})
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">分組方式</Label>
              <RadioGroup
                value={groupingMode}
                onValueChange={(v) => setGroupingMode(v as GroupingMode)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bySize" id="bySize" data-testid="radio-by-size" />
                  <Label htmlFor="bySize" className="text-sm cursor-pointer">每組人數</Label>
                  {groupingMode === 'bySize' && (
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={groupSize}
                      onChange={(e) => setGroupSize(parseInt(e.target.value) || 4)}
                      className="w-16 text-center"
                      data-testid="input-group-size"
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="byCount" id="byCount" data-testid="radio-by-count" />
                  <Label htmlFor="byCount" className="text-sm cursor-pointer">總組數</Label>
                  {groupingMode === 'byCount' && (
                    <Input
                      type="number"
                      min={2}
                      max={50}
                      value={groupCount}
                      onChange={(e) => setGroupCount(parseInt(e.target.value) || 3)}
                      className="w-16 text-center"
                      data-testid="input-group-count"
                    />
                  )}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">性別選項</Label>
              <RadioGroup
                value={genderMode}
                onValueChange={(v) => setGenderMode(v as GenderMode)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mixed" id="mixed" data-testid="radio-mixed" />
                  <Label htmlFor="mixed" className="text-sm cursor-pointer">男女混合（平衡比例）</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="split" id="split" data-testid="radio-split" />
                  <Label htmlFor="split" className="text-sm cursor-pointer">男女分開</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <Button 
            onClick={createGroups} 
            className="w-full"
            size="lg"
            disabled={people.length === 0}
            data-testid="button-shuffle"
          >
            <Shuffle className="w-5 h-5 mr-2" />
            開始分組
          </Button>
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">分組結果</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={createGroups}
                data-testid="button-reshuffle"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                重新分組
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyAllGroups}
                data-testid="button-copy-all"
              >
                {copiedAll ? (
                  <Check className="w-4 h-4 mr-1 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 mr-1" />
                )}
                複製全部
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map((group) => {
              const stats = getGroupStats(group);
              return (
                <Card 
                  key={group.id} 
                  className={cn(
                    "hover-elevate transition-all",
                    genderMode === 'split' && stats.males > 0 && stats.females === 0 && "border-blue-200 dark:border-blue-800",
                    genderMode === 'split' && stats.females > 0 && stats.males === 0 && "border-pink-200 dark:border-pink-800"
                  )}
                  data-testid={`card-group-${group.id}`}
                >
                  <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      第 {group.id} 組
                      <Badge variant="secondary" className="text-xs">
                        {stats.total} 人
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyGroup(group)}
                      data-testid={`button-copy-group-${group.id}`}
                    >
                      {copiedGroup === group.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {group.members.map((member, idx) => (
                        <li 
                          key={idx} 
                          className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                        >
                          <span>{member.name}</span>
                          {getGenderBadge(member.gender)}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            此分組結果不會被儲存，重新整理頁面後將會消失
          </p>
        </div>
      )}
    </div>
  );
};
