import React from 'react';

/**
 * Standardized delete button for all attachments to maintain UI consistency.
 * Uses a trash icon (🗑️) to represent file/element deletion clearly.
 *
 * @param {Object} props
 * @param {Function} props.onDelete - Callback when the user confirms deletion.
 * @param {string} [props.confirmMessage] - Text for the confirm dialog.
 * @param {string} [props.className] - Additional classes (overrides default text colors if provided).
 * @param {string} [props.title="Supprimer"] - Tooltip text.
 */
export const DeleteButton = ({ 
    onDelete, 
    confirmMessage = 'Confirmer la suppression ?', 
    className = '',
    title = 'Supprimer' 
}) => {
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent opening the file or triggering parent clicks
        if (window.confirm(confirmMessage)) {
            onDelete();
        }
    };

    // Base styling: red hover effects, scalable text size.
    // We append the custom className at the end so it can override things if needed.
    const baseClasses = "text-red-400 hover:text-red-300 transition-colors shrink-0 flex items-center justify-center";
    
    return (
        <button 
            onClick={handleClick} 
            className={`${baseClasses} ${className}`} 
            title={title}
            aria-label={title}
        >
            🗑️
        </button>
    );
};
