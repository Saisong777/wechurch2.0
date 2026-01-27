import React from 'react';

interface ActionItemListProps {
  items: string[];
}

export const ActionItemList: React.FC<ActionItemListProps> = ({ items }) => {
  if (items.length === 0) return null;
  
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, index) => (
        <div 
          key={index}
          className="flex items-start gap-3 p-2 rounded-lg bg-blue-100/30 dark:bg-blue-900/20"
        >
          <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex-shrink-0 mt-0.5 flex items-center justify-center">
            <span className="text-xs text-blue-600 font-bold">{index + 1}</span>
          </div>
          <p className="text-sm text-foreground">{item}</p>
        </div>
      ))}
    </div>
  );
};
