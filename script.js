// Global variables
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
const inputBox = document.getElementById('input');
const prioritySelect = document.getElementById('priority');
const dueDateInput = document.getElementById('due-date');
const listContainer = document.querySelector('.list-container');
const progressBar = document.getElementById('progress-bar');
const searchInput = document.getElementById('search');
const filterSelect = document.getElementById('filter');
const themeToggle = document.getElementById('theme-toggle');
const completedTodaySpan = document.getElementById('completed-today');
const completedWeekSpan = document.getElementById('completed-week');
const streakSpan = document.getElementById('streak');

// Debounce utility for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced save function to reduce localStorage writes
const debouncedSaveTasks = debounce(saveTasks, 300);

// Initialize libraries
flatpickr(dueDateInput, { dateFormat: "Y-m-d" });
new Sortable(listContainer, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: () => saveTasks()
});

// Sound effects using Web Audio API
function playSound(frequency = 440, duration = 200) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

function addTask(){
    const text = inputBox.value.trim();
    if (!text) return;
    const priority = prioritySelect.value;
    const dueDate = dueDateInput.value;
    // Escape user input for security
    const escapedText = text.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#39;'
    }[char]));
    const task = { id: Date.now(), text: escapedText, priority, dueDate, completed: false };
    tasks.unshift(task);
    renderTasks();
    debouncedSaveTasks(); // Use debounced save for performance
    playSound(523, 150); // C note
    inputBox.value = '';
    dueDateInput.value = '';
    prioritySelect.value = 'low';
}

function renderTasks(){
    listContainer.innerHTML = '';
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.text.toLowerCase().includes(searchInput.value.toLowerCase());
        const matchesFilter = filterSelect.value === 'all' ||
            (filterSelect.value === 'pending' && !task.completed) ||
            (filterSelect.value === 'completed' && task.completed);
        return matchesSearch && matchesFilter;
    });

    if (filteredTasks.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-check-circle"></i>
                <h4>No tasks found</h4>
                <p>Add a new task to get started!</p>
                <button class="btn btn-primary mt-2" onclick="inputBox.focus()">Add Your First Task</button>
            </div>
        `;
        return;
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.className = `priority-${task.priority}`;
        if (task.completed) li.classList.add('checked');
        if (task.dueDate && new Date(task.dueDate) < new Date()) li.classList.add('overdue');
        li.innerHTML = `
            <span class="drag-handle" aria-label="Drag to reorder" tabindex="0">⋮⋮</span>
            <span class="task-text" style="font-size: 0.9em;">${task.text}</span>
            ${task.dueDate ? `<small class="text-muted ms-2">${task.dueDate}</small>` : ''}
            <span class="edit-btn me-5" aria-label="Edit task" tabindex="0"><i class="bi bi-pencil"></i></span>
            <span class="delete-btn ms-2" aria-label="Delete task" tabindex="0"><i class="bi bi-trash text-danger"></i></span>
        `;
        // Adjust layout for flexbox
        const taskText = li.querySelector('.task-text');
        taskText.style.flex = '1';
        taskText.style.marginRight = '10px';
        li.dataset.id = task.id;
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'listitem');
        li.setAttribute('aria-label', `Task: ${task.text}, Priority: ${task.priority}, ${task.completed ? 'Completed' : 'Pending'}`);
        listContainer.appendChild(li);
        li.classList.add('task-enter');
    });
    updateProgress();
    updateStats();
    // Announce task list updates to screen readers
    listContainer.setAttribute('aria-live', 'polite');
}

function updateProgress(){
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total ? (completed / total) * 100 : 0;
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
}

function updateStats(){
    const today = new Date().toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedToday = tasks.filter(t => t.completed && new Date(t.completedAt).toDateString() === today).length;
    const completedWeek = tasks.filter(t => t.completed && new Date(t.completedAt) > weekAgo).length;
    const streak = calculateStreak();
    completedTodaySpan.textContent = completedToday;
    completedWeekSpan.textContent = completedWeek;
    streakSpan.textContent = streak;
    streakSpan.setAttribute('title', `Current streak: ${streak} days`);
}

function calculateStreak(){
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const completedOnDate = tasks.some(t => t.completed && new Date(t.completedAt).toDateString() === date.toDateString());
        if (completedOnDate) streak++;
        else if (i > 0) break;
    }
    return streak;
}

function saveTasks(){
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

function checkNotifications(){
    if ('Notification' in window && Notification.permission === 'granted') {
        tasks.forEach(task => {
            if (!task.completed && task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()) {
                new Notification('Task Due Today', { body: task.text });
            }
        });
    }
}

function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const li = document.querySelector(`[data-id="${taskId}"]`);
    const taskTextSpan = li.querySelector('.task-text');
    const originalText = task.text;

    // Create inline edit input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = originalText;
    editInput.className = 'form-control d-inline-block';
    editInput.style.width = '100%';
    editInput.setAttribute('aria-label', 'Edit task text');

    // Replace text span with input
    taskTextSpan.replaceWith(editInput);
    editInput.focus();
    editInput.select();

    const saveEdit = () => {
        const newText = editInput.value;
        if (newText !== originalText) {
            task.text = newText;
            renderTasks();
            debouncedSaveTasks();
        } else {
            renderTasks(); // Revert if no change
        }
    };

    const cancelEdit = () => {
        renderTasks(); // Revert to original
    };

    editInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });

    editInput.addEventListener('blur', saveEdit);
}

function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'tasks.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importTasks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const importedTasks = JSON.parse(e.target.result);
                    if (Array.isArray(importedTasks)) {
                        // Validate imported tasks for security
                        const validTasks = importedTasks.filter(task =>
                            task && typeof task === 'object' &&
                            typeof task.id === 'number' &&
                            typeof task.text === 'string' &&
                            ['low', 'medium', 'high'].includes(task.priority) &&
                            typeof task.completed === 'boolean'
                        );
                        if (validTasks.length !== importedTasks.length) {
                            alert('Some tasks were invalid and skipped during import.');
                        }
                        tasks = [...tasks, ...validTasks];
                        renderTasks();
                        debouncedSaveTasks();
                        alert('Tasks imported successfully!');
                    } else {
                        alert('Invalid file format.');
                    }
                } catch (error) {
                    alert('Error importing tasks.');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// Event listeners
document.querySelector('button[onclick="addTask()"]').addEventListener('click', addTask);
document.addEventListener("keydown", e => {
    if (e.key === "Enter") addTask();
});

listContainer.addEventListener("click", e => {
    const li = e.target.closest('li');
    if (!li) return;
    const id = +li.dataset.id;
    if (e.target.tagName === "LI" || e.target.classList.contains('drag-handle') || e.target.classList.contains('task-text')) {
        const task = tasks.find(t => t.id === id);
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date() : null;
        if (task.completed) {
            playSound(659, 150); // E note
            // Optimize confetti: reduce particle count and spread for better performance
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
        }
        renderTasks();
        debouncedSaveTasks();
    } else if (e.target.classList.contains('edit-btn') || e.target.closest('.edit-btn')) {
        editTask(id);
    } else if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
        tasks = tasks.filter(t => t.id !== id);
        li.classList.add('task-exit');
        setTimeout(() => {
            renderTasks();
            debouncedSaveTasks();
        }, 500);
        playSound(330, 150); // E low
    }
});

listContainer.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const li = e.target;
        const id = +li.dataset.id;
        const task = tasks.find(t => t.id === id);
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date() : null;
        if (task.completed) {
            playSound(659, 150);
            // Optimize confetti: reduce particle count and spread for better performance
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
        }
        renderTasks();
        debouncedSaveTasks();
    }
});

searchInput.addEventListener('input', renderTasks);
filterSelect.addEventListener('change', renderTasks);

const clearAllBtn = document.getElementById('clear-all');
clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
        tasks = [];
        renderTasks();
        saveTasks();
        playSound(220, 200); // A low note for clear action
    }
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    themeToggle.innerHTML = document.body.classList.contains('dark-mode') ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

document.getElementById('export-btn').addEventListener('click', exportTasks);
document.getElementById('import-btn').addEventListener('click', importTasks);

// Load theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.innerHTML = '☀️ Light Mode';
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Initialize tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
});

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}

// Initial render and notifications
renderTasks();
checkNotifications();
setInterval(checkNotifications, 60000); // Check every minute
