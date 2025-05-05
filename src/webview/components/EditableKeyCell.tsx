import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

interface EditableKeyCellProps {
  keyName: string;
  path: string[];
  onSave: (path: string[], oldKey: string, newKey: string) => void;
}

// 編集可能なキーセルコンポーネント
export const EditableKeyCell: React.FC<EditableKeyCellProps> = ({ keyName, path, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(keyName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== keyName && editValue.trim() !== '') {
      onSave(path, keyName, editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(keyName);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="key-cell-input"
        style={{
          width: '90%',
          boxSizing: 'border-box',
          padding: '8px',
          border: '1px solid var(--button-background)',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontWeight: 'bold',
          backgroundColor: 'var(--format-background)',
          color: 'var(--format-text)'
        }}
      />
    );
  }

  return (
    <div 
      className="key-text" 
      onDoubleClick={handleDoubleClick}
      style={{ 
        cursor: 'pointer',
        padding: '6px 8px',
        borderRadius: '4px',
        transition: 'background-color 0.15s ease'
      }}
    >
      {keyName}
    </div>
  );
}; 