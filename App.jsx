
import { useState } from 'react';

export default function App() {
    const [todos, setTodos] = useState([]);
    const [text, setText] = useState('');

    const add = () => {
        if (!text.trim()) return;

        setTodos([
            ...todos,
            {
                id: Date.now(),
                text: text.trim(),
                done: false,
            },
        ]);

        setText('');
    };

    const toggle = (id) => {
        setTodos(
            todos.map((todo) =>
                todo.id === id
                    ? { ...todo, done: !todo.done }
                    : todo
            )
        );
    };

    return (
        <div
            style={{
                maxWidth: 500,
                margin: '40px auto',
                fontFamily: 'sans-serif',
                padding: '0 20px',
            }}
        >
            <h1 style={{ color: '#4472C4' }}>
                Todo React
            </h1>

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 16,
                }}
            >
                <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') add();
                    }}
                    placeholder="Ajouter une tâche..."
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                    }}
                />

                <button
                    onClick={add}
                    style={{
                        background: '#4472C4',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 4,
                        cursor: 'pointer',
                    }}
                >
                    Ajouter
                </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {todos.map((todo) => (
                    <li
                        key={todo.id}
                        onClick={() => toggle(todo.id)}
                        style={{
                            padding: '10px 14px',
                            marginBottom: 6,
                            background: todo.done ? '#E2EFDA' : '#f0f0f5',
                            borderRadius: 4,
                            cursor: 'pointer',
                            textDecoration: todo.done
                                ? 'line-through'
                                : 'none',
                            border: '1px solid #dde1ea',
                        }}
                    >
                        {todo.text}
                    </li>
                ))}
            </ul>

            <p style={{ color: '#888', fontSize: '.85rem' }}>
                {todos.filter((todo) => !todo.done).length}
                {' '}tâche(s) restante(s)
            </p>
        </div>
    );
}
