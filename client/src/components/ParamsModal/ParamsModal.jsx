import React, { useState } from 'react';
import { X } from 'lucide-react';
import './ParamsModal.css';

/**
 * Generic parameter prompt modal.
 * params: [{ paramName, dataType, isOutput, hasDefault, defaultValue }]
 * onExecute: (values: { [paramName]: string }) => void
 * title: string
 */
export default function ParamsModal({ title, params, onExecute, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {};
    params.forEach(p => { init[p.paramName] = p.defaultValue ?? ''; });
    return init;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onExecute(values);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="params-modal modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title || 'Execute with Parameters'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="params-body">
            {params.length === 0 && (
              <div className="params-empty">This procedure has no parameters.</div>
            )}
            {params.map(p => (
              <div key={p.paramName} className="form-group params-row">
                <label className="params-label">
                  <span className="params-name">{p.paramName}</span>
                  <span className="params-type">{p.dataType}{p.isOutput ? ' OUT' : ''}</span>
                </label>
                <input
                  value={values[p.paramName] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [p.paramName]: e.target.value }))}
                  placeholder={p.hasDefault ? `default: ${p.defaultValue ?? 'null'}` : 'required'}
                  readOnly={!!p.isOutput}
                  className={p.isOutput ? 'params-output' : ''}
                />
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Execute</button>
          </div>
        </form>
      </div>
    </div>
  );
}
