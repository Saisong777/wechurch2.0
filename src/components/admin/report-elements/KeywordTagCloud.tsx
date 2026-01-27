import React from 'react';

export type TagVariant = 'themes' | 'observations' | 'insights' | 'applications';

const variantColors: Record<TagVariant, string> = {
  themes: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200',
  observations: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 hover:bg-teal-200',
  insights: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 hover:bg-yellow-200',
  applications: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200',
};

interface KeywordTagCloudProps {
  keywords: string[];
  variant?: TagVariant;
}

export const KeywordTagCloud: React.FC<KeywordTagCloudProps> = ({ 
  keywords, 
  variant = 'themes' 
}) => {
  if (keywords.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {keywords.map((keyword, index) => (
        <span
          key={index}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${variantColors[variant]}`}
        >
          {keyword}
        </span>
      ))}
    </div>
  );
};
