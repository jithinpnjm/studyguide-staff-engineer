import React from 'react';
import AIAgent from '@site/src/components/AIAgent';

export default function Root({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {children}
      <AIAgent />
    </>
  );
}
