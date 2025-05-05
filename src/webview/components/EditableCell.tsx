import * as React from 'react';
import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: any;
  path: string[];
  onSave: (path: string[], newValue: any) => void;
}

// 編集可能なセルコンポーネント
export const EditableCell: React.FC<EditableCellProps> = ({ value, path, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value !== null && value !== undefined ? String(value) : '');
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
    let finalValue: any = editValue;
    
    // 値の型を推測して変換
    if (editValue === 'true') {
      finalValue = true;
    } else if (editValue === 'false') {
      finalValue = false;
    } else if (!isNaN(Number(editValue)) && editValue !== '') {
      finalValue = Number(editValue);
    } else if (editValue === '') {
      finalValue = null;
    }
    
    onSave(path, finalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value !== null && value !== undefined ? String(value) : '');
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
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px',
          border: '1px solid var(--button-background)',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          backgroundColor: 'var(--panel-background)',
          color: 'var(--text-color)'
        }}
      />
    );
  }

  const baseStyle = {
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '3px',
    display: 'inline-block',
    transition: 'background-color 0.15s ease'
  };

  if (typeof value === 'boolean') {
    return <span className="boolean-value" onDoubleClick={handleDoubleClick} style={baseStyle}>{value.toString()}</span>;
  }

  if (typeof value === 'number') {
    return <span className="number-value" onDoubleClick={handleDoubleClick} style={baseStyle}>{value}</span>;
  }

  if (typeof value === 'string') {
    if (value.length > 100) {
      return <span className="string-value" onDoubleClick={handleDoubleClick} style={baseStyle}>{value.substring(0, 100)}...</span>;
    }
    return <span className="string-value" onDoubleClick={handleDoubleClick} style={baseStyle}>{value}</span>;
  }

  if (value === null || value === undefined) {
    return <span className="undefined-value" onDoubleClick={handleDoubleClick} style={baseStyle}>undefined</span>;
  }

  return <span onDoubleClick={handleDoubleClick} style={baseStyle}>{String(value)}</span>;
}; 