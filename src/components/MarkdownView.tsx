import React from 'react';

interface MarkdownViewProps {
  text: string;
}

export default function MarkdownView({ text }: MarkdownViewProps) {
  if (!text) return null;

  const lines = text.split('\n');

  // Format bold helper
  const formatBold = (str: string) => {
    // Regex matches **text** or *text*
    const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="font-medium text-slate-800 italic">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-2.5 text-slate-700 leading-relaxed text-sm md:text-base font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Header 1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-2xl font-bold text-blue-900 border-b border-slate-200 pb-2 pt-4 mt-6 first:mt-2">
              {formatBold(trimmed.substring(2))}
            </h1>
          );
        }
        
        // Header 2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-xl font-semibold text-slate-800 border-b border-slate-100 pb-1 pt-3 mt-4">
              {formatBold(trimmed.substring(3))}
            </h2>
          );
        }
        
        // Header 3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-lg font-semibold text-slate-800 pt-2 mt-3">
              {formatBold(trimmed.substring(4))}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start ml-3 space-x-2 my-1">
              <span className="text-blue-500 mt-1 select-none text-xs">◆</span>
              <span className="flex-1 text-slate-700">{formatBold(content)}</span>
            </div>
          );
        }

        // Number list (e.g., "1. ")
        const matchNum = trimmed.match(/^(\d+)\.\s(.*)/);
        if (matchNum) {
          const num = matchNum[1];
          const content = matchNum[2];
          return (
            <div key={idx} className="flex items-start ml-3 space-x-2 my-1">
              <span className="text-blue-700 font-bold mt-0.5 select-none min-w-[18px] text-right">{num}.</span>
              <span className="flex-1 text-slate-700">{formatBold(content)}</span>
            </div>
          );
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-4 border-blue-500 bg-blue-50/50 p-3 rounded-r my-3 text-slate-700">
              {formatBold(trimmed.substring(2))}
            </blockquote>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Normal text line
        return (
          <p key={idx} className="text-slate-600 pl-1 leading-relaxed">
            {formatBold(line)}
          </p>
        );
      })}
    </div>
  );
}
