import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx(
      'bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl',
      className
    )}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-4 py-6 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-4 py-6 sm:p-8', className)}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx(
      'flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8',
      className
    )}>
      {children}
    </div>
  );
};

export default Card;