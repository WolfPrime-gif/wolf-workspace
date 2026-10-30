"use strict";

// ========================================
// WOLF WORKSPACE — APPLICATION ENGINE
// ========================================

const $ = (selector) => document.querySelector(selector);

function getUserStorageKey(key) {
    try {
        const storedUser = localStorage.getItem('wolf_current_user');
        if (!storedUser) return `wolf_guest_${key}`;
        
        const currentUser = JSON.parse(storedUser);
        const userEmail = (currentUser && currentUser.email) ? currentUser.email : 'guest';
        return `wolf_${userEmail}_${key}`;
    } catch (e) {
        console.error("Storage key error:", e);
        return `wolf_guest_${key}`;
    }
}

// 3. Synchronous local loader utilizing user-specific storage key
function loadProjectsFromLocal() {
    try {
        const STORAGE_KEY = getUserStorageKey('projects');
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];  
        const parsed = JSON.parse(saved);  
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Local storage error:", error);
        return [];
    }
}

// 4. Synchronous local saver utilizing user-specific storage key
function saveProjectsToLocal() {
    try {
        const STORAGE_KEY = getUserStorageKey('projects');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
        console.error("Local storage error:", error);
    }
}

// Load safely on boot
let projects = loadProjectsFromLocal();
let activeProjectId = null;

// ========================================
// THEME CUSTOMIZER SYSTEM
// ========================================

const themeSelect = $("#themeSelect");

function applyTheme(themeName) {
    // Remove existing theme classes from body
    document.body.classList.remove("theme-emerald-hacker", "theme-crimson-alpha");

    if (themeName === "emerald-hacker") {
        document.body.classList.add("theme-emerald-hacker");
    } else if (themeName === "crimson-alpha") {
        document.body.classList.add("theme-crimson-alpha");
    } // "wolf-cyber" uses default :root variables

    // Saving theme per user
localStorage.setItem(getUserStorageKey("theme"), themeName);
}
function initTheme() {
    // Loading theme per user
const savedTheme = localStorage.getItem(getUserStorageKey("theme"))  || "wolf-cyber";
    
    if (themeSelect) {
        themeSelect.value = savedTheme;
        themeSelect.addEventListener("change", (e) => {
            const selectedTheme = e.target.value;
            applyTheme(selectedTheme);
            if (typeof showToast === "function") {
                showToast(`🎨 Theme changed to ${e.target.options[e.target.selectedIndex].text}`);
            }
        });
    }

    applyTheme(savedTheme);
}

// Initialize theme on script load
initTheme();

// Dashboard elements
const dashboardView = $("#dashboardView");
const projectWorkspace = $("#projectWorkspace");
const projectForm = $("#projectForm");
const exportView = $("#exportView");

const exportNoteTitle = $("#exportNoteTitle");
const exportNoteCategory = $("#exportNoteCategory");
const exportNoteTags = $("#exportNoteTags");
const exportNoteDate = $("#exportNoteDate");
const exportNoteContent = $("#exportNoteContent");

const copyExportNote = $("#copyExportNote");
const downloadExportPdf = $("#downloadExportPdf");
const closeExportView = $("#closeExportView");

let currentExportNote = null;
const projectNameInput = $("#projectName");
const projectDescriptionInput = $("#projectDescription");
const projectList = $("#projectList");

// Statistics
const totalProjects = $("#totalProjects");
const totalTasks = $("#totalTasks");
const completedTasks = $("#completedTasks");

// Workspace elements
const backToDashboard = $("#backToDashboard");
const workspaceProjectName = $("#workspaceProjectName");
const workspaceProjectDescription = $("#workspaceProjectDescription");
const editWorkspaceProject = $("#editWorkspaceProject");
const deleteWorkspaceProject = $("#deleteWorkspaceProject");

// Task elements
const workspaceTaskForm = $("#workspaceTaskForm");
const workspaceTaskInput = $("#workspaceTaskInput");
const taskPriority = $("#taskPriority");
const taskDueDate = $("#taskDueDate");
const workspaceTaskList = $("#workspaceTaskList");
const projectProgressText = $("#projectProgressText");
const projectProgressBar = $("#projectProgressBar");

// Project Notes elements
const noteForm = $("#noteForm");
const noteTitle = $("#noteTitle");
const noteContent = $("#noteContent");
const notesList = $("#notesList");
const noteSearch = $("#noteSearch");
const noteCategoryFilter = $("#noteCategoryFilter");
const noteTagFilter = $("#noteTagFilter");
const resetNoteFilters = $("#resetNoteFilters");
const noteCategory = $("#noteCategory");
const noteTags = $("#noteTags");
const noteCount = $("#noteCount");
const noteSort = $("#noteSort");

// Sidebar
const projectSidebar = $("#projectSidebar");
const toggleSidebar = $("#toggleSidebar");
const sidebarOverlay = $("#sidebarOverlay");

// ========================================
// APPLICATION DATA
// ========================================

const STORAGE_KEY = "wolfWorkspaceProjects_v1";


// ========================================
// DATA STORAGE (FIREBASE CLOUD FIRESTORE + LOCAL FALLBACK)
// ========================================

// Optional: Background cloud sync runner to fetch latest from Firebase after login
async function syncProjectsFromCloud() {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) return;

    try {
        const docRef = db.collection("users").doc(user.uid).collection("workspace").doc("projectsData");
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            const rawProjects = data.projects || [];
            
            // Run your robust validation pipeline
            const validatedProjects = rawProjects
                .filter(project =>  
                    project &&  
                    typeof project.id === "string" &&  
                    typeof project.name === "string" &&  
                    Array.isArray(project.tasks)  
                )  
                .map(project => ({  
                    id: project.id,  
                    name: project.name,  
                    description: typeof project.description === "string" ? project.description : "",  
                    category: typeof project.category === "string" ? project.category : "Development",  
                    createdAt: project.createdAt || Date.now(),  
                    color: typeof project.color === "string" ? project.color : "#00f0ff",
                    tags: Array.isArray(project.tags) ? project.tags.filter(tag => typeof tag === "string") : [],
                    tasks: project.tasks  
                        .filter(task => task && typeof task.id === "string" && typeof task.text === "string")  
                        .map(task => ({
                            id: task.id,
                            text: task.text,
                            completed: task.completed === true,
                        status: typeof task.status === "string" ? task.status : (task.completed ? "completed" : "todo"),
                        priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
                        dueDate: typeof task.dueDate === "string" ? task.dueDate : ""
                    })),
                notes: Array.isArray(project.notes) ? project.notes : [],
                files: Array.isArray(project.files) ? project.files : []
            }));

            if (validatedProjects.length > 0) {
                projects = validatedProjects;
                saveProjectsToLocal();
                if (typeof renderProjects === 'function') renderProjects();
                if (typeof updateDashboardStats === 'function') updateDashboardStats();
            }
        }
    } catch (error) {
        console.error("Cloud sync skipped:", error);
    }
}



// 2. Unified save function (Saves locally first using user-specific key, then syncs to Cloud)
async function saveProjects() {
    saveProjectsToLocal(); // Instant local save

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) return true;

    try {
        const docRef = db.collection("users").doc(user.uid).collection("workspace").doc("projectsData");
        await docRef.set({
            projects: projects,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;  
    } catch (error) {  
        console.error("Unable to save projects to Cloud:", error);  
        showToast("⚠️ Cloud sync failed. Changes saved locally.", false);  
        return false;  
    }
}

// ========================================
// ID GENERATION & UTILS
// ========================================

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;  
    if (text !== undefined) element.textContent = text;  
    return element;
}

function createButton(text, className, onClick) {
    const button = createElement("button", className, text);
    button.type = "button";  
    button.addEventListener("click", onClick);  
    return button;
}

function getActiveProject() {
    return projects.find(project => project.id === activeProjectId) || null;
}

// ========================================
// CUSTOM REUSABLE CONFIRMATION MODAL LOGIC
// ========================================

function showCustomConfirm(title, message, confirmText = "Delete") {
    return new Promise((resolve) => {
        const confirmModal = $("#confirmModal");
        const confirmModalTitle = $("#confirmModalTitle");
        const confirmModalMessage = $("#confirmModalMessage");
        const actionConfirmBtn = $("#actionConfirmBtn");
        const cancelConfirmBtn = $("#cancelConfirmBtn");
        const closeConfirmModal = $("#closeConfirmModal");

        if (!confirmModal) {
            resolve(window.confirm(message));
            return;
        }

        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        actionConfirmBtn.textContent = confirmText;
        confirmModal.classList.remove("hidden");

        const cleanup = () => {
            confirmModal.classList.add("hidden");
            actionConfirmBtn.removeEventListener("click", onConfirm);
            cancelConfirmBtn.removeEventListener("click", onCancel);
            if (closeConfirmModal) closeConfirmModal.removeEventListener("click", onCancel);
        };

        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        actionConfirmBtn.addEventListener("click", onConfirm);
        cancelConfirmBtn.addEventListener("click", onCancel);
        if (closeConfirmModal) closeConfirmModal.addEventListener("click", onCancel);
    });
}

// ========================================
// DASHBOARD & STATS RENDERING
// ========================================

let activeCategoryFilter = "All";

document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", () => {
        document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeCategoryFilter = pill.dataset.category;
        renderDashboard(globalSearchInput ? globalSearchInput.value.trim().toLowerCase() : "");
    });
});

function renderDashboard(searchQuery = "") {
    if (!projectList) return;
    projectList.replaceChildren();

const safeProjects = Array.isArray(projects) ? projects : (projects ? Object.values(projects) : []);

const filteredProjects = safeProjects.filter(project => {
        const matchesCategory = (activeCategoryFilter === "All") || (project.category === activeCategoryFilter);
        if (!searchQuery) return matchesCategory;

        const matchesName = project.name.toLowerCase().includes(searchQuery);
        const matchesDesc = (project.description || "").toLowerCase().includes(searchQuery);
        const matchesTasks = Array.isArray(project.tasks) && project.tasks.some(t => t.text.toLowerCase().includes(searchQuery));
        
        return matchesCategory && (matchesName || matchesDesc || matchesTasks);
    });

        filteredProjects.forEach(project => {
        const card = createElement("article", "project-card");
        if (project.color) {
            card.style.borderLeftColor = project.color;
        }
        
        const categoryBadge = createElement("span", "project-category-badge", project.category || "General");
        card.appendChild(categoryBadge);

        const title = createElement("h3", "", project.name);
        const desc = createElement("p", "", project.description || "No description provided.");
        
        // Render Tags
        if (Array.isArray(project.tags) && project.tags.length > 0) {
            const tagsContainer = createElement("div", "project-tags-list");
            project.tags.forEach(tag => {
                tagsContainer.appendChild(createElement("span", "project-tag-pill", `#${tag}`));
            });
            card.appendChild(tagsContainer);
        }

        const completed = project.tasks.filter(task => task.completed).length;
        const taskSummary = createElement("p", "", `${completed} of ${project.tasks.length} tasks completed`);

        const openBtn = createElement("button", "", "Open Project →");
        openBtn.type = "button";
        openBtn.addEventListener("click", () => openProject(project.id));

        card.append(title, desc, taskSummary, openBtn);
        projectList.appendChild(card);
    });

    if (filteredProjects.length === 0) {
        const emptyState = createElement("div", "empty-state", "🐺 No matching projects found.");
        projectList.appendChild(emptyState);
    }

    updateDashboardStats();
}

const globalSearchInput = $("#globalSearchInput");
if (globalSearchInput) {
    globalSearchInput.addEventListener("input", (e) => {
        renderDashboard(e.target.value.toLowerCase().trim());
    });
}

function updateDashboardStats() {
    const totalProjectsElem = $("#totalProjects");
    const totalTasksElem = $("#totalTasks");
    const completedTasksElem = $("#completedTasks");
    const overdueElem = $("#overdueTasks");
    const upcomingElem = $("#upcomingTasks");
    const percentageTextElem = $("#missionPercentageText");
    const progressFillElem = $("#missionProgressFill");
    const statusBadgeElem = $("#missionStatusBadge");

    if (!totalProjectsElem) return;

    // Bulletproof array check
    const allProjects = Array.isArray(projects) ? projects : [];
    const allTasks = allProjects.flatMap(p => (p && Array.isArray(p.tasks)) ? p.tasks : []);

    const totalTaskCount = allTasks.length;
    const completedTaskCount = allTasks.filter(t => t && t.completed).length;

    const today = new Date();
    const todayString = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");
    
      // Overdue: Uncompleted tasks with due date strictly before today
    const overdueCount = allTasks.filter(t => t && !t.completed && t.dueDate && t.dueDate < todayString).length;
    
    // Upcoming: Uncompleted tasks due today or in the future (>= todayString)
    const upcomingCount = allTasks.filter(t => t && !t.completed && t.dueDate && t.dueDate >= todayString).length;
    const completionPercentage = totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);
   
    totalProjectsElem.textContent = allProjects.length;
    totalTasksElem.textContent = totalTaskCount;
    completedTasksElem.textContent = completedTaskCount;

    if (overdueElem) overdueElem.textContent = overdueCount;
    if (upcomingElem) upcomingElem.textContent = upcomingCount;

    if (percentageTextElem) percentageTextElem.textContent = `${completionPercentage}%`;
    if (progressFillElem) progressFillElem.style.width = `${completionPercentage}%`;

    if (statusBadgeElem) {
        if (allProjects.length === 0) {
            statusBadgeElem.textContent = "STANDBY MODE";
            statusBadgeElem.style.color = "#94a3b8";
        } else if (overdueCount > 0) {
            statusBadgeElem.textContent = `CRITICAL (${overdueCount} OVERDUE)`;
            statusBadgeElem.style.color = "#ef4444";
        } else {
            statusBadgeElem.textContent = `SYSTEM ACTIVE (${completionPercentage}% COMPLETE)`;
            statusBadgeElem.style.color = "#00f0ff";
        }
    }
}

// ========================================
// CREATE PROJECT
// ========================================

projectForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = projectNameInput.value.trim();  
    const description = projectDescriptionInput.value.trim();  
    const categoryInput = $("#projectCategory");
    const selectedCategory = categoryInput ? categoryInput.value : "Development";
    const projectColor = $("#projectColor") ? $("#projectColor").value : "#00f0ff";
    const projectTagsRaw = $("#projectTags") ? $("#projectTags").value : "";
    const tags = projectTagsRaw.split(",").map(t => t.trim()).filter(Boolean);


    if (!name) {  
        showToast("Enter a project name first.");  
        projectNameInput.focus();  
        return;  
    }  

    const project = {  
        id: createId(),  
        name,  
        description,  
        category: selectedCategory,
        color: projectColor,
        tags: tags,
        createdAt: Date.now(),  
        tasks: [], 
        notes: [],
        files: []
    };
    // Bulletproof array check before pushing the new project
if (!Array.isArray(projects)) {
    projects = projects ? Object.values(projects) : [];
}

projects.push(project);


    if (!saveProjects()) {  
        projects.pop();  
        return;  
    }  

    projectForm.reset();  
    renderDashboard();  
    showToast("🐺 Project created successfully!");
    openProject(project.id);
});

// ========================================
// NAVIGATION & VIEW SWITCHERS
// ========================================

function showDashboard() {
    activeProjectId = null;
    projectWorkspace.classList.add("hidden");  
    dashboardView.classList.remove("hidden");  
    renderDashboard();  
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openProject(projectId) {
    activeProjectId = projectId;
    const project = getActiveProject();
    if (!project) return;

    if (dashboardView) dashboardView.classList.add("hidden");
    if (projectWorkspace) projectWorkspace.classList.remove("hidden");

    resetWorkspaceToTasks();
    renderWorkspace(); 
}

function resetWorkspaceToTasks() {
    const tasksSection = $("#tasksSection");
    const notesSection = $("#notesSection");
    const filesSection = $("#filesSection");
    const settingsSection = $("#settingsView");
    const projectDetailsBlock = document.querySelector(".project-details");

    if (tasksSection) tasksSection.classList.add("hidden");
    if (notesSection) notesSection.classList.add("hidden");
    if (filesSection) filesSection.classList.add("hidden");
    if (settingsSection) settingsSection.classList.add("hidden");

    if (tasksSection) tasksSection.classList.remove("hidden");
    if (projectDetailsBlock) projectDetailsBlock.classList.remove("hidden");

    document.querySelectorAll("#projectSidebar .nav-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-section") === "tasks");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

backToDashboard.addEventListener("click", showDashboard);

function renderWorkspace() {
    const project = getActiveProject();
    if (!project) {  
        showDashboard();  
        return;  
    }  

    workspaceProjectName.textContent = project.name;  
    workspaceProjectDescription.textContent = project.description || "No description provided.";  

    const allTags = [...new Set(project.notes.flatMap(note => Array.isArray(note.tags) ? note.tags : []))].sort((a, b) => a.localeCompare(b));
    const previousTag = noteTagFilter.value;

    noteTagFilter.replaceChildren();
    const allOption = createElement("option", "", "All Tags");
    allOption.value = "All";
    noteTagFilter.appendChild(allOption);

    allTags.forEach(tag => {
        const option = createElement("option", "", tag);
        option.value = tag;
        noteTagFilter.appendChild(option);
    });

    noteTagFilter.value = allTags.includes(previousTag) ? previousTag : "All";

    renderTasks();  
    renderNotes();  
    updateProjectProgress();
}

// ========================================
// EDIT & DELETE PROJECT MODALS
// ========================================

const editProjectModal = $("#editProjectModal");
const editProjectForm = $("#editProjectForm");
const editProjectName = $("#editProjectName");
const editProjectDescription = $("#editProjectDescription");
const editProjectCategory = $("#editProjectCategory");
const closeEditModal = $("#closeEditModal");
const cancelEditProject = $("#cancelEditProject");

function openEditModal() {
    const project = getActiveProject();
    if (!project) return;  
    editProjectName.value = project.name;  
    editProjectDescription.value = project.description || "";  
    if (editProjectCategory) editProjectCategory.value = project.category || "Development";

        const editColor = $("#editProjectColor");
    const editTags = $("#editProjectTags");
    if (editColor) editColor.value = project.color || "#00f0ff";
    if (editTags) editTags.value = Array.isArray(project.tags) ? project.tags.join(", ") : "";
  
    editProjectModal.classList.remove("hidden");  
    editProjectName.focus();
}

function closeModal() {
    editProjectModal.classList.add("hidden");
    editProjectForm.reset();
    if (editWorkspaceProject) editWorkspaceProject.focus();
}

if (editWorkspaceProject) editWorkspaceProject.addEventListener("click", openEditModal);
if (cancelEditProject) cancelEditProject.addEventListener("click", closeModal);
if (closeEditModal) closeEditModal.addEventListener("click", closeModal);

editProjectModal.addEventListener("click", event => {
    if (event.target === editProjectModal) closeModal();
});

editProjectForm.addEventListener("submit", event => {
    event.preventDefault();
    const project = getActiveProject();  
    if (!project) { closeModal(); return; }  

    const newName = editProjectName.value.trim();  
    const newDescription = editProjectDescription.value.trim();  
    const newCategory = editProjectCategory ? editProjectCategory.value : "Development";
    const editColor = $("#editProjectColor");
    const editTags = $("#editProjectTags");
    
    if (!newName) { showToast("Project name cannot be empty.", false); editProjectName.focus(); return; }  

    project.name = newName;  
    project.description = newDescription;  
    project.category = newCategory;
    if (editColor) project.color = editColor.value;
    if (editTags) project.tags = editTags.value.split(",").map(t => t.trim()).filter(Boolean);
   
    if (!saveProjects()) { showToast("Failed to save changes.", false); return; }  

    renderWorkspace();  
    renderDashboard();  
    closeModal();  
    showToast("🐺 Project updated successfully!");
});

const deleteProjectModal = $("#deleteProjectModal");
const deleteProjectName = $("#deleteProjectName");
const closeDeleteModal = $("#closeDeleteModal");
const cancelDeleteProject = $("#cancelDeleteProject");
const confirmDeleteProject = $("#confirmDeleteProject");

function openDeleteModal() {
    const project = getActiveProject();
    if (!project) return;  
    deleteProjectName.textContent = project.name;  
    deleteProjectModal.classList.remove("hidden");  
    cancelDeleteProject.focus();
}

function closeDeleteModalWindow() {
    deleteProjectModal.classList.add("hidden");
    deleteWorkspaceProject.focus();
}

deleteWorkspaceProject.addEventListener("click", openDeleteModal);
cancelDeleteProject.addEventListener("click", closeDeleteModalWindow);
closeDeleteModal.addEventListener("click", closeDeleteModalWindow);

deleteProjectModal.addEventListener("click", event => {
    if (event.target === deleteProjectModal) closeDeleteModalWindow();
});

confirmDeleteProject.addEventListener("click", () => {
    const project = getActiveProject();
    if (!project) { closeDeleteModalWindow(); return; }  

    const projectIndex = projects.findIndex(item => item.id === project.id);  
    if (projectIndex === -1) { closeDeleteModalWindow(); return; }  

    // ---> MOVE TO TRASH BIN <---
    moveItemToTrash("project", project);

    projects.splice(projectIndex, 1);  
    saveProjects();
    closeDeleteModalWindow();  
    showDashboard();
    showToast("🗑️ Project moved to trash bin.");
});

// ========================================
// TASKS SYSTEM
// ========================================

workspaceTaskForm.addEventListener("submit", event => {
    event.preventDefault();
    const project = getActiveProject();  
    const text = workspaceTaskInput.value.trim();  

    if (!project) { showToast("Open a project before adding tasks."); return; }  
    if (!text) { workspaceTaskInput.focus(); return; }  

  const task = {
        id: createId(),
        text,
        completed: false,
        status: "todo", // Default status
        priority: taskPriority.value,
        dueDate: taskDueDate.value
    };

    project.tasks.push(task);  
    saveProjects();  
    workspaceTaskForm.reset();  
    renderTasks();  
    updateProjectProgress();  
    renderDashboard();  
    workspaceTaskInput.focus();
});

function renderTasks() {
    workspaceTaskList.replaceChildren();
    const project = getActiveProject();
    if (!project) return;

    if (project.tasks.length === 0) {
        workspaceTaskList.appendChild(createElement("div", "empty-state", "No tasks yet. Add your first task above."));
        return;
    }

    const today = new Date();
    const todayString = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    project.tasks.forEach(task => {
        const item = createElement("article", task.completed ? "task-item completed" : "task-item");

        const checkbox = createElement("input", "task-checkbox");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            task.status = checkbox.checked ? "completed" : "todo"; // <--- Add this line to keep Kanban & List in sync!
            saveProjects();
            renderTasks();
            updateProjectProgress();
            renderDashboard();
        });


        const content = createElement("div", "task-item-content");
        content.appendChild(createElement("div", "task-description", task.text));

        const priority = ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium";
        content.appendChild(createElement("span", `task-priority priority-${priority}`, priority.toUpperCase() + " PRIORITY"));

        if (task.dueDate) {
            const deadline = createElement("div", "task-deadline");
            deadline.textContent = `📅 Due: ${task.dueDate}`;
            if (!task.completed && task.dueDate < todayString) {
                deadline.classList.add("task-overdue");
                deadline.textContent += " — OVERDUE";
            } else if (!task.completed && task.dueDate === todayString) {
                deadline.classList.add("task-due-today");
                deadline.textContent += " — DUE TODAY";
            }
            content.appendChild(deadline);
        }

        const actions = createElement("div", "task-actions");
        actions.append(
            createButton("Edit", "edit-task-button", () => openEditTaskModal(task.id)),
            createButton("Delete", "delete-task-button", () => openDeleteTaskModal(task.id))
        );

        item.append(checkbox, content, actions);
        workspaceTaskList.appendChild(item);
    });
}

function updateProjectProgress() {
    const project = getActiveProject();
    if (!project) {  
        projectProgressText.textContent = "0%";  
        projectProgressBar.value = 0;  
        return;  
    }  

    const total = project.tasks.length;  
    const completed = project.tasks.filter(task => task.completed).length;  
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);  

    projectProgressText.textContent = `${percentage}%`;  
    projectProgressBar.value = percentage;  
}

// Edit & Delete Task Modal Logic
const editTaskModal = $("#editTaskModal");
const editTaskForm = $("#editTaskForm");
const editTaskText = $("#editTaskText");
const editTaskPriority = $("#editTaskPriority");
const editTaskDueDate = $("#editTaskDueDate");
const closeEditTaskModal = $("#closeEditTaskModal");
const cancelEditTask = $("#cancelEditTask");
let editingTaskId = null;

function openEditTaskModal(taskId) {
    const project = getActiveProject();
    if (!project) return;
    const task = project.tasks.find(item => item.id === taskId);
    if (!task) return;

    editingTaskId = task.id;
    editTaskText.value = task.text;
    editTaskPriority.value = task.priority || "medium";
    editTaskDueDate.value = task.dueDate || "";
    editTaskModal.classList.remove("hidden");
    editTaskText.focus();
}

function closeEditTaskWindow() {
    editTaskModal.classList.add("hidden");
    editTaskForm.reset();
    editingTaskId = null;
}

if (closeEditTaskModal) closeEditTaskModal.addEventListener("click", closeEditTaskWindow);
if (cancelEditTask) cancelEditTask.addEventListener("click", closeEditTaskWindow);

editTaskForm.addEventListener("submit", event => {
    event.preventDefault();
    const project = getActiveProject();
    if (!project || !editingTaskId) { closeEditTaskWindow(); return; }

    const task = project.tasks.find(item => item.id === editingTaskId);
    if (!task) { closeEditTaskWindow(); return; }

    task.text = editTaskText.value.trim();
    task.priority = editTaskPriority.value;
    task.dueDate = editTaskDueDate.value;

    saveProjects();
    closeEditTaskWindow();
    showToast("Task updated successfully!");
    renderTasks();
    updateProjectProgress();
    renderDashboard();
});

const deleteTaskModal = $("#deleteTaskModal");
const deleteTaskName = $("#deleteTaskName");
const closeDeleteTaskModal = $("#closeDeleteTaskModal");
const cancelDeleteTask = $("#cancelDeleteTask");
const confirmDeleteTask = $("#confirmDeleteTask");
let deletingTaskId = null;

function openDeleteTaskModal(taskId) {
    const project = getActiveProject();
    if (!project) return;  
    const task = project.tasks.find(item => item.id === taskId);  
    if (!task) return;  

    deletingTaskId = task.id;  
    deleteTaskName.textContent = task.text;  
    deleteTaskModal.classList.remove("hidden");  
    cancelDeleteTask.focus();
}

function closeDeleteTaskWindow() {
    deleteTaskModal.classList.add("hidden");
    deletingTaskId = null;
}

if (closeDeleteTaskModal) closeDeleteTaskModal.addEventListener("click", closeDeleteTaskWindow);
if (cancelDeleteTask) cancelDeleteTask.addEventListener("click", closeDeleteTaskWindow);

confirmDeleteTask.addEventListener("click", () => {
    const project = getActiveProject();
    if (!project || !deletingTaskId) { closeDeleteTaskWindow(); return; }  

    const taskToDelete = project.tasks.find(task => task.id === deletingTaskId);
    if (taskToDelete) {
        // ---> MOVE TO TRASH BIN <---
        moveItemToTrash("task", taskToDelete);
    }

    project.tasks = project.tasks.filter(task => task.id !== deletingTaskId);
    saveProjects();  
    closeDeleteTaskWindow();  
    renderTasks();  
    updateProjectProgress();  
    renderDashboard();
    showToast("🗑️ Task moved to trash.");
});

// ========================================
// SIDEBAR & WORKSPACE SECTION SWITCHER
// ========================================

function openSidebar() {
    projectSidebar.classList.add("drawer-open");
    sidebarOverlay.classList.add("visible");
    document.body.classList.add("sidebar-locked");
    toggleSidebar.setAttribute("aria-expanded", "true");  
    sidebarOverlay.setAttribute("aria-hidden", "false");  
}

function closeSidebar() {
    projectSidebar.classList.remove("drawer-open");
    sidebarOverlay.classList.remove("visible");
    document.body.classList.remove("sidebar-locked");
    toggleSidebar.setAttribute("aria-expanded", "false");  
    sidebarOverlay.setAttribute("aria-hidden", "true");  
}

if (toggleSidebar) {
    toggleSidebar.addEventListener("click", () => {
        if (projectSidebar.classList.contains("drawer-open")) closeSidebar();
        else openSidebar();
    });
}
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

const tasksSection = $("#tasksSection");
const notesSection = $("#notesSection");
const filesSection = $("#filesSection");
const settingsSection = $("#settingsView"); 
const projectDetailsBlock = document.querySelector(".project-details");

function showWorkspaceSection(sectionName) {
    if (tasksSection) tasksSection.classList.add("hidden");
    if (notesSection) notesSection.classList.add("hidden");
    if (filesSection) filesSection.classList.add("hidden");
    if (settingsSection) settingsSection.classList.add("hidden");

    if (sectionName === "tasks") {
        if (tasksSection) tasksSection.classList.remove("hidden");
        if (projectDetailsBlock) projectDetailsBlock.classList.remove("hidden");
        renderTasks();
    } else if (sectionName === "notes") {
        if (notesSection) notesSection.classList.remove("hidden");
        if (projectDetailsBlock) projectDetailsBlock.classList.add("hidden");
        renderNotes();
    } else if (sectionName === "files") {
        if (filesSection) filesSection.classList.remove("hidden");
        if (projectDetailsBlock) projectDetailsBlock.classList.add("hidden");
        renderFiles();
    } else if (sectionName === "settings") {
        if (settingsSection) settingsSection.classList.remove("hidden");
        if (projectDetailsBlock) projectDetailsBlock.classList.add("hidden");
        renderSettings();
    }

    if (projectSidebar) {
        projectSidebar.querySelectorAll(".nav-item").forEach(button => {
            button.classList.toggle("active", button.dataset.section === sectionName);
        });
    }
}
projectSidebar.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", (event) => {
        event.preventDefault();
        const targetSection = button.getAttribute("data-section");
        if (!targetSection) return;

        // If settings is clicked
        if (targetSection === "settings") {
    showOnlyMainView('settingsView');
    if (typeof renderSettings === 'function') {
        renderSettings();
    }
} else {
    showOnlyMainView('projectWorkspace');
    showWorkspaceSection(targetSection);
}

        closeSidebar();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});

const closeSidebarBtn = $("#closeSidebarBtn");
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);

// ========================================
// NOTES SYSTEM & EXPORT
// ========================================
function renderNotes() {
    notesList.replaceChildren();
    const project = getActiveProject();
    if (!project) return;
    if (!Array.isArray(project.notes)) project.notes = [];

    if (project.notes.length === 0) {
        notesList.appendChild(createElement("p", "empty-state", "No notes yet. Create your first note!"));
        return;
    }

    const searchTerm = noteSearch.value.trim().toLowerCase();
    
    // Read the current select dropdown value directly
    const sortSelect = document.getElementById("noteSort");
    const activeSort = sortSelect ? sortSelect.value : "newest";

    // 1. Filter notes first
    const filteredNotes = project.notes.filter(note => {
        const matchesSearch = note.title.toLowerCase().includes(searchTerm) || note.content.toLowerCase().includes(searchTerm);
        const matchesCategory = noteCategoryFilter.value === "All" || (note.category || "General") === noteCategoryFilter.value;
        const matchesTag = noteTagFilter.value === "All" || (Array.isArray(note.tags) && note.tags.includes(noteTagFilter.value));
        return matchesSearch && matchesCategory && matchesTag;
    });

    // 2. Sort notes (Pinned top priority, then matching dropdown selection)
    filteredNotes.sort((a, b) => {
        // Pinned notes float to the top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Apply dropdown filter rules based on value attributes ("newest", "oldest", "title")
        if (activeSort === "oldest") {
            return (a.updatedAt || 0) - (b.updatedAt || 0);
        } else if (activeSort === "title") {
            return (a.title || "").localeCompare(b.title || "");
        } else {
            // "newest" (default)
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        }
    });

    noteCount.textContent = `${filteredNotes.length} of ${project.notes.length} notes`;

    filteredNotes.forEach(note => {
        const card = createElement("article", note.pinned ? "note-card pinned-note" : "note-card");
        const title = createElement("h3", "", note.title);
        const content = createElement("p", "", note.content);
        const category = createElement("span", "note-category", note.category || "General");

        const tagsContainer = createElement("div", "note-tags");
        (note.tags || []).forEach(tag => tagsContainer.appendChild(createElement("span", "note-tag", tag)));

        const updated = createElement("small", "note-updated", "Last updated: " + new Date(note.updatedAt || Date.now()).toLocaleString());
        const actions = createElement("div", "note-actions");  
        const noteHeader = createElement("div", "note-header");

        const editButton = createButton("Edit", "edit-note-button", () => {
            noteTitle.value = note.title;
            noteContent.value = note.content;
            noteCategory.value = note.category || "General";
            noteTags.value = (note.tags || []).join(", ");
            noteForm.dataset.editingNoteId = note.id;
            const saveButton = noteForm.querySelector('button[type="submit"]');
            if (saveButton) saveButton.textContent = "Update Note";
            cancelNoteEdit.hidden = false;
            noteTitle.focus();
        });
      // 2. Declare deleteButton right here so it exists!
const deleteButton = createButton("Delete", "delete-note-button", () => {
    openDeleteNoteModal(note.id);
});
  
    async function openDeleteNoteModal(noteId) {
    const project = getActiveProject();
    if (!project) return;

    const noteToDelete = (project.notes || []).find(n => n.id === noteId);
    if (!noteToDelete) return;

    // 🔒 GUARD: Prevent deleting pinned notes
    if (noteToDelete.pinned) {
        showToast("⚠️ You cannot delete a pinned note unless you unpin it first.", false);
        return; // Stops execution completely
    }

    // Await custom confirmation modal
    const confirmed = typeof showCustomConfirm === 'function' 
        ? await showCustomConfirm(`Are you sure you want to delete note "${noteToDelete.title || 'Untitled'}"?`)
        : window.confirm(`Are you sure you want to delete note "${noteToDelete.title || 'Untitled'}"?`);

    if (confirmed) {
        // Move to trash bin
        moveItemToTrash("note", noteToDelete);
        
        showToast(`🗑️ "${noteToDelete.title || 'Untitled'}" moved to trash!`, true);
        
        project.notes = project.notes.filter(n => n.id !== noteId);
        saveProjects();
        renderNotes();
    }
}

const exportButton = createButton("📥 Export", "export-note-button", (e) => {
    if (e) e.preventDefault(); // Prevents page redirects

    // 1. Safely grab all export view elements from your HTML
    const view = document.getElementById("exportView");
    const titleElem = document.getElementById("exportNoteTitle");
    const catElem = document.getElementById("exportNoteCategory");
    const tagsElem = document.getElementById("exportNoteTags");
    const dateElem = document.getElementById("exportNoteDate");
    const contentElem = document.getElementById("exportNoteContent");
    
    const dash = document.getElementById("dashboardView");
    const workspace = document.getElementById("projectWorkspace");

    if (!view) {
        console.error("Export view element not found in DOM!");
        return;
    }

    // 2. Set the global tracker
    currentExportNote = note;

    // 3. Populate fields safely with fallbacks
    if (titleElem) titleElem.textContent = note.title || "Untitled Note";
    if (catElem) catElem.textContent = note.category || "General";
    if (tagsElem) tagsElem.textContent = (note.tags || []).join(", ") || "None";
    if (dateElem) {
        dateElem.textContent = note.updatedAt 
            ? new Date(Number(note.updatedAt)).toLocaleString() 
            : "Unknown";
    }
    if (contentElem) contentElem.textContent = note.content || "";

    // 4. Toggle views cleanly using consistent classes
    if (dash) dash.classList.add("hidden");
    if (workspace) workspace.classList.add("hidden");
    
    // Remove hidden attribute and class to ensure it displays
    view.hidden = false;
    view.classList.remove("hidden");

    window.scrollTo(0, 0);
});

        const pinButton = createButton(
    note.pinned ? "📌 Unpin" : "📌 Pin",
    "pin-note-button",
    () => {
        note.pinned = !Boolean(note.pinned);

        saveProjects();
        renderNotes();

        showToast(note.pinned ? "Note pinned to the top!" : "Note unpinned.");
    }
);
    const noteSort = document.getElementById("noteSort");
if (noteSort) {
    noteSort.addEventListener("change", renderNotes);
}

        noteHeader.append(title, pinButton);
        actions.append(exportButton, editButton, deleteButton);
        card.append(noteHeader, category, content, tagsContainer, updated, actions);
        notesList.appendChild(card);
    });
}

if (noteSearch) noteSearch.addEventListener("input", renderNotes);
if (noteCategoryFilter) noteCategoryFilter.addEventListener("change", renderNotes);
if (noteTagFilter) noteTagFilter.addEventListener("change", renderNotes);
if (resetNoteFilters) resetNoteFilters.addEventListener("click", () => {
    noteSearch.value = "";
    noteCategoryFilter.value = "All";
    noteTagFilter.value = "All";
    renderNotes();
});

if (noteSort) noteSort.addEventListener("change", renderNotes);

noteForm.addEventListener("submit", event => {
    event.preventDefault();
    const project = getActiveProject();
    if (!project) { showToast("Open a project before saving notes."); return; }

    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    const editingId = noteForm.dataset.editingNoteId;
    const category = noteCategory.value;
    const tags = noteTags.value.split(",").map(tag => tag.trim()).filter(Boolean);

    if (!title || !content) { showToast("Enter both title and content."); return; }
    if (!Array.isArray(project.notes)) project.notes = [];

    if (editingId) {
        const note = project.notes.find(item => item.id === editingId);
        if (note) {
            note.title = title;
            note.content = content;
            note.category = category;
            note.tags = tags;
            note.updatedAt = Date.now();
            saveProjects();
        }
        delete noteForm.dataset.editingNoteId;
        noteForm.reset();
        cancelNoteEdit.hidden = true;
        const saveButton = noteForm.querySelector('button[type="submit"]');
        if (saveButton) saveButton.textContent = "Save Note";
        renderNotes();
        showToast("Note updated successfully!");
        return;
    }

    project.notes.push({ id: createId(), title, content, category, tags, updatedAt: Date.now() });
    saveProjects();
    noteForm.reset();
    renderNotes();
    showToast("Note saved successfully!");
});

const cancelNoteEdit = createButton("Cancel Edit", "cancel-note-edit", () => {
    noteForm.reset();
    delete noteForm.dataset.editingNoteId;
    const saveButton = noteForm.querySelector('button[type="submit"]');
    if (saveButton) saveButton.textContent = "Save Note";
    cancelNoteEdit.hidden = true;
});
cancelNoteEdit.hidden = true;
noteForm.appendChild(cancelNoteEdit);

//EXPORT NOTES HANDLER
copyExportNote.addEventListener("click", async () => {
if (!currentExportNote) return;

const note = currentExportNote;  

const text = [

"🐺 WOLF WORKSPACE",
"Your projects. Your mission. Your progress.",
"",
"📄 NOTE DETAILS",
"----------------------------------------",
"Title: " + (note.title || "Untitled Note"),
"Category: " + (note.category || "General"),
"Tags: " + ((note.tags || []).join(", ") || "None"),
"Last Updated: " + (
note.updatedAt
? new Date(Number(note.updatedAt)).toLocaleString()
: "Unknown"
),
"",
"💻 NOTE CONTENT",
"----------------------------------------",
note.content || "",
"",
"🐾 ORGANIZE • PLAN • ACHIEVE",
"Built for Bigger Goals."
].join("\n");

try {  
    await navigator.clipboard.writeText(text);  
    showToast("🐺 Wolf note copied!");  
} catch (error) {  
    window.prompt("Copy your note:", text);  
}

});
downloadExportPdf.addEventListener("click", () => {
if (!currentExportNote) {
showToast("No note selected for export.");
return;
}
if (!window.jspdf || !window.jspdf.jsPDF) {
showToast("PDF library unavailable. Check your internet.");
return;
}

const note = currentExportNote;  
const { jsPDF } = window.jspdf;  

const pdf = new jsPDF({  
    orientation: "portrait",  
    unit: "mm",  
    format: "a4"  
});  

const pageWidth = pdf.internal.pageSize.getWidth();  
const pageHeight = pdf.internal.pageSize.getHeight();  
const margin = 18;  
const contentWidth = pageWidth - margin * 2;  
let y = 20;  

function addPageIfNeeded(height) {  
    if (y + height > pageHeight - margin) {  
        pdf.addPage();  
        y = 20;  
    }  
}  

function addLabel(text) {  
    addPageIfNeeded(10);  
    pdf.setTextColor(22, 140, 255);  
    pdf.setFont("helvetica", "bold");  
    pdf.setFontSize(10);  
    pdf.text(text, margin, y);  
    y += 7;  
}  

function addText(text, fontSize = 11) {  
    pdf.setFont("helvetica", "normal");  
    pdf.setFontSize(fontSize);  
    pdf.setTextColor(35, 45, 60);  

    const lines = pdf.splitTextToSize(String(text || ""), contentWidth);  

    for (const line of lines) {  
        addPageIfNeeded(6);  
        pdf.text(line, margin, y);  
        y += 6;  
    }  
    y += 2;  
}  

// Wolf Workspace branding  
pdf.setFillColor(16, 28, 48);  
pdf.rect(0, 0, pageWidth, 38, "F");  

pdf.setTextColor(69, 163, 255);  
pdf.setFont("helvetica", "bold");  
pdf.setFontSize(20);  
pdf.text("WOLF WORKSPACE", margin, 17);  

pdf.setTextColor(230, 240, 255);  
pdf.setFont("helvetica", "normal");  
pdf.setFontSize(10);  
pdf.text("Your projects. Your mission. Your progress.", margin, 27);  

y = 49;  

addLabel("NOTE TITLE");  
addText(note.title || "Untitled Note", 16);  

addLabel("CATEGORY");  
addText(note.category || "General");  

addLabel("TAGS");  
addText((note.tags || []).join(", ") || "None");  

addLabel("LAST UPDATED");  
addText(  
    note.updatedAt  
        ? new Date(Number(note.updatedAt)).toLocaleString()  
        : "Unknown"  
);  

addLabel("NOTE CONTENT");  
addText(note.content || "No content.");  

// Footer on every page  
const pageCount = pdf.getNumberOfPages();  
for (let page = 1; page <= pageCount; page++) {  
    pdf.setPage(page);  
    pdf.setDrawColor(22, 119, 255);  
    pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);  

    pdf.setTextColor(70, 110, 150);  
    pdf.setFontSize(8);  
    pdf.text("WOLF WORKSPACE | Built for Bigger Goals.", margin, pageHeight - 8);  
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });  
}  

const safeTitle = String(note.title || "Wolf_Note")  
    .replace(/[^a-z0-9_-]/gi, "_")  
    .slice(0, 60);  

try {  
    // Generate the PDF blob directly and create a clickable button on screen  
    const pdfBlob = pdf.output("blob");  
    const blobUrl = URL.createObjectURL(pdfBlob);  

    // Remove any old download button if it exists so they don't stack up  
    const existingBtn = document.getElementById("dynamic-pdf-download-btn");  
    if (existingBtn) {  
    URL.revokeObjectURL(existingBtn.href);  
   existingBtn.remove();  
    }  

    const downloadBtn = document.createElement("a");  
    downloadBtn.id = "dynamic-pdf-download-btn";  
    downloadBtn.href = blobUrl;  
    downloadBtn.download = `${safeTitle}.pdf`;  
    downloadBtn.innerText = "📥 Tap Here to Download PDF File";  
    downloadBtn.style.cssText = `  
        display: block;   
        margin: 20px auto;   
        padding: 14px 20px;   
        background: #168cff;   
        color: #fff;   
        text-align: center;   
        border-radius: 8px;   
        text-decoration: none;   
        font-weight: bold;   
        font-family: sans-serif;  
        box-shadow: 0 4px 10px rgba(22, 140, 255, 0.4);  
    `;  
      
    // Append it inside your export view or container so it's clearly visible to tap  
    const exportContainer = document.querySelector("#exportView") || document.body;  
    exportContainer.appendChild(downloadBtn);  

    showToast("📄 PDF ready! Tap the blue download button below.");  
} catch (error) {  
    console.error("Download creation error:", error);  
    showToast("❌ Could not create download link.");  
}

});
const closeExportBtn = document.getElementById("closeExportView");
if (closeExportBtn) {
    closeExportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const view = document.getElementById("exportView");
        const workspace = document.getElementById("projectWorkspace");
        
        if (view) {
            view.hidden = true;
            view.classList.add("hidden");
        }
        // Return to active project workspace or dashboard
        if (workspace && activeProjectId) {
            workspace.classList.remove("hidden");
        } else {
            const dash = document.getElementById("dashboardView");
            if (dash) dash.classList.remove("hidden");
        }
        window.scrollTo(0, 0);
    });
}

// ========================================
// PROJECT FILES & MULTI-UPLOAD SYSTEM
// ========================================

const projectFileInput = $("#projectFileInput");
const projectFilesList = $("#projectFilesList");

// Handle multiple file selection & conversion to Base64
if (projectFileInput) {
    projectFileInput.addEventListener("change", (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const project = getActiveProject();
        if (!project) return;
        if (!project.files) project.files = [];

        let addedCount = 0;

        // Loop through all selected files
        Array.from(files).forEach((file) => {
            // Optional: Limit individual file size to 2MB
            if (file.size > 2 * 1024 * 1024) {
                showToast(`⚠️ "${file.name}" is too large (Max 2MB).`, false);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                project.files.push({
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                    name: file.name,
                    type: file.type || "application/octet-stream",
                    size: formatFileSize(file.size),
                    data: e.target.result,
                    uploadedAt: new Date().toLocaleDateString()
                });

                saveProjects();
                renderFiles();
            };

            reader.readAsDataURL(file);
            addedCount++;
        });

        projectFileInput.value = "";
        if (addedCount > 0) {
            showToast(`📎 Successfully attached ${addedCount} file(s)!`);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function renderFiles() {
    if (!projectFilesList) return;
    projectFilesList.replaceChildren();

    const project = getActiveProject();
    const files = (project && project.files) ? project.files : [];

    const fileCountBadge = $("#fileCountBadge");
    if (fileCountBadge) fileCountBadge.textContent = `${files.length} ${files.length === 1 ? "File" : "Files"}`;

    if (files.length === 0) {
        projectFilesList.appendChild(createElement("div", "empty-state", "📭 No files attached yet."));
        return;
    }

    files.forEach(file => {
        const fileItem = createElement("div", "file-item");
        const infoDiv = createElement("div", "file-info");
        infoDiv.style.cursor = "pointer";
        infoDiv.addEventListener("click", () => openFilePreview(file));

        let iconSymbol = "📄";
        if (file.type.startsWith("image/")) iconSymbol = "🖼️";
        else if (file.type.includes("pdf")) iconSymbol = "📑";

        const details = createElement("div", "file-details");
        details.append(createElement("span", "file-name", file.name), createElement("span", "file-meta", `${file.size} • Added ${file.uploadedAt}`));
        infoDiv.append(createElement("span", "file-icon", iconSymbol), details);

        const actionsDiv = createElement("div", "file-actions");
        const downloadBtn = createButton("Download", "file-download-btn", () => {
            const link = document.createElement("a");
            link.href = file.data;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

                const deleteBtn = createButton("Delete", "file-delete-btn", async () => {
            const confirmed = await showCustomConfirm("🗑️ Delete File", `Are you sure you want to delete "${file.name}"?`);
            if (confirmed) {
                // ---> MOVE TO TRASH BIN <---
                moveItemToTrash("file", file);

                project.files = project.files.filter(f => f.id !== file.id);
                saveProjects();
                renderFiles();
                showToast(`🗑️ "${file.name}" moved to trash!`);
            }
        });

        actionsDiv.append(downloadBtn, deleteBtn);
        fileItem.append(infoDiv, actionsDiv);
        projectFilesList.appendChild(fileItem);
    });
}

// ========================================
// REFINED FILE PREVIEW MODAL LOGIC (PDFs, Images, Code)
// ========================================

const filePreviewModal = $("#filePreviewModal");
const closePreviewModal = $("#closePreviewModal");
const previewModalTitle = $("#previewModalTitle");
const filePreviewBody = $("#filePreviewBody");
const previewFileMeta = $("#previewFileMeta");
const previewDownloadBtn = $("#previewDownloadBtn");

function openFilePreview(file) {
    if (!filePreviewModal) return;

    previewModalTitle.textContent = file.name;
    previewFileMeta.textContent = `${file.size} • ${file.type || "Unknown Type"}`;
    filePreviewBody.replaceChildren();

    // 1. Image Preview
    if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = file.data;
        img.alt = file.name;
        img.style.cssText = "max-width: 100%; max-height: 50vh; display: block; margin: 0 auto; border-radius: 8px;";
        filePreviewBody.appendChild(img);
    } 
    // 2. PDF Preview via Iframe
    else if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
        const iframe = document.createElement("iframe");
        iframe.src = file.data;
        iframe.style.cssText = "width: 100%; height: 50vh; border: none; border-radius: 8px; background: #fff;";
        filePreviewBody.appendChild(iframe);
    }
    // 3. Text / Code Files (.js, .html, .css, .txt, .json, .md)
    else if (file.type.includes("text") || file.name.match(/\.(js|html|css|json|txt|md)$/i)) {
        try {
            const base64Content = file.data.split(",")[1];
            const decodedText = atob(base64Content);
            const pre = document.createElement("pre");
            pre.className = "file-preview-text";
            pre.style.cssText = "max-height: 50vh; overflow-y: auto; background: var(--bg); padding: 12px; border-radius: 8px; font-size: 0.85rem; color: var(--text); text-align: left;";
            pre.textContent = decodedText;
            filePreviewBody.appendChild(pre);
        } catch (e) {
            const fallbackMsg = createElement("p", "settings-desc", "Unable to decode text preview.");
            filePreviewBody.appendChild(fallbackMsg);
        }
    } 
    // 4. Fallback for other formats
    else {
        const unsupportedMsg = createElement("p", "settings-desc", "📁 Preview not available for this file type. Click download below to view it.");
        unsupportedMsg.style.textAlign = "center";
        unsupportedMsg.style.padding = "20px";
        filePreviewBody.appendChild(unsupportedMsg);
    }

    // Bind download action inside preview modal
    previewDownloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = file.data;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`📥 Downloading ${file.name}`);
    };

    filePreviewModal.classList.remove("hidden");
}

if (closePreviewModal) {
    closePreviewModal.addEventListener("click", () => {
        filePreviewModal.classList.add("hidden");
    });
}

if (filePreviewModal) {
    filePreviewModal.addEventListener("click", (e) => {
        if (e.target === filePreviewModal) {
            filePreviewModal.classList.add("hidden");
        }
    });
}

// =================================
// WOLF WORKSPACE - FIREBASE AUTH LOGIC
// =================================

document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const verifyView = document.getElementById('verifyView');

    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const displayUserEmail = document.getElementById('displayUserEmail');

    // 1. View Switching Handlers
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginView?.classList.add('hidden');
            verifyView?.classList.add('hidden');
            signupView?.classList.remove('hidden');
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signupView?.classList.add('hidden');
            verifyView?.classList.add('hidden');
            loginView?.classList.remove('hidden');
        });
    }

    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            verifyView?.classList.add('hidden');
            signupView?.classList.add('hidden');
            loginView?.classList.remove('hidden');
        });
    }

    // 2. Password Visibility Toggles
    setupPasswordToggles();

 // Helper: Set user session and render dashboard (fixes blank screen)
function handleLogin(email) {
    // Use the 'email' parameter correctly
    const currentUserData = { email: email }; 
    localStorage.setItem('wolf_current_user', JSON.stringify(currentUserData));

    // Hide auth views / show app
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    
    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    // Reload projects scoped to this exact email
    if (typeof loadProjects === 'function') {
        loadProjects();
    }
    if (typeof renderWorkspace === 'function') {
        renderWorkspace();
    }
}

// 3. Signup Form Handler
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameEl = document.getElementById('signupName');
        const emailEl = document.getElementById('signupEmail');
        const passwordEl = document.getElementById('signupPassword');
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        if (!nameEl || !emailEl || !passwordEl || !submitBtn) return;

        const email = emailEl.value;
        const password = passwordEl.value;

        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.style.background = '#f59e0b';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.innerHTML = `⏳ Sending Verification...`;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.sendEmailVerification();

            if (displayUserEmail) displayUserEmail.textContent = email;
            if (signupView) signupView.classList.add('hidden');
            if (verifyView) verifyView.classList.remove('hidden');

        } catch (err) {
            console.error('Firebase Signup Error:', err);
            alert('Error: ' + err.message);
            nameEl.value = '';
            emailEl.value = '';
            passwordEl.value = '';
            nameEl.focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.background = '';
            submitBtn.style.cursor = 'pointer';
            submitBtn.innerHTML = originalText;
        }
    });
}

// Resend Verification Email Button (Moved Outside)
const resendBtn = document.getElementById('resendEmailBtn');
if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (user) {
            try {
                await user.sendEmailVerification();
                alert('Verification email re-sent! Please check your inbox and spam folder.');
            } catch (err) {
                alert('Error resending email: ' + err.message);
            }
        } else {
            alert('No active registration session found. Please try logging in.');
        }
    });
}

// Verification Check Button Handler (Moved Outside)
const checkVerifyBtn = document.getElementById('checkVerificationBtn');
if (checkVerifyBtn) {
    checkVerifyBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (user) {    
            await user.reload(); 
            if (auth.currentUser.emailVerified) {
                alert('Email verified successfully! Welcome to Wolf Workspace.');
                handleLogin(auth.currentUser.email);
            } else {
                alert('Email is not verified yet. Please check your Gmail inbox/spam and tap the verification link first.');
            }
        } else {
            alert('No active session found. Please log in.');
        }
    });
}

// 4. Login Form Handler
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            if (!userCredential.user.emailVerified) {
                alert('Please check your email and click the verification link before logging in.');
                await auth.signOut();
                return;
            }

            // Save user session & trigger live UI render instantly
            handleLogin(userCredential.user.email);

        } catch (err) {
            console.error('Firebase Login Error:', err);
            alert('Login Failed: ' + err.message);
        }
    });
}
   
// 5. Standalone Logout Function
function handleLogout() {
    // Clear local storage sessions and cached user data
    localStorage.removeItem('wolf_current_user');
    
    // Clear global state array if declared globally
    if (typeof currentProjects !== 'undefined') {
        currentProjects = [];
    }

    // Toggle views if DOM elements exist
    const appContainer = document.getElementById('app-container');
    const authContainer = document.getElementById('auth-container');
    
    if (appContainer) appContainer.style.display = 'none';
    if (authContainer) authContainer.style.display = 'block';

    // Clear DOM lists / re-evaluate UI
    if (typeof renderWorkspace === 'function') {
        renderWorkspace();
    }
}

// 5. Explicit Event Listener
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        const confirmed = typeof showCustomConfirm === 'function'
            ? await showCustomConfirm("🐺 Wolf Security", "Are you sure you want to terminate session?")
            : confirm("Are you sure you want to log out?");

        if (confirmed) {
            try {
                // Sign out Firebase/Auth if active
                if (typeof auth !== 'undefined' && auth.signOut) {
                    await auth.signOut();
                }
            } catch (err) {
                console.error("Logout error:", err);
            } finally {
                // Always clean local storage & refresh to reset full state
                handleLogout();
                window.location.reload();
            }
        }
    });
}

});
// Helper: Add Password Show/Hide Toggles
function setupPasswordToggles() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        if (input.parentNode.style.position !== 'relative') {
            input.parentNode.style.position = 'relative';
        }
        
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.innerHTML = '👁️';
        toggleBtn.style.cssText = `
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            background: none; border: none; cursor: pointer; font-size: 1rem; color: #94a3b8; padding: 4px;
        `;

        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.innerHTML = '🙈';
            } else {
                input.type = 'password';
                toggleBtn.innerHTML = '👁️';
            }
        });

        input.parentNode.appendChild(toggleBtn);
    });
}
// Helper: Sync User Profile and Show Dashboard
function syncProfileAndHideModal(user) {
    const authModal = document.getElementById('authModal');
    const dashboardView = document.getElementById('dashboardView');
    const projectWorkspace = document.getElementById('projectWorkspace');

    // Hide authentication modal
    if (authModal) {
        authModal.classList.add('hidden');
    }

    // Hide project workspace
    if (projectWorkspace) {
        projectWorkspace.classList.add('hidden');
    }

    // Reveal dashboard
    if (dashboardView) {
        dashboardView.classList.remove('hidden');
    }

    // Update user profile
    const userNameEl = document.getElementById('userNameDisplay');
    const userEmailEl = document.getElementById('userEmailDisplay');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) {
        userNameEl.textContent = user.displayName || user.email.split('@')[0];
    }

    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }

    if (userAvatarEl) {
        userAvatarEl.textContent = user.email.charAt(0).toUpperCase();
    }

    // Render dashboard
    if (typeof renderDashboard === 'function') {
        renderDashboard();
    }

    console.log("🐺 Dashboard successfully activated.");
}
      
function renderSettings() {
    // 1. Storage Calculation
    try {
        let totalBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalBytes += key.length + (value ? value.length : 0);
        }
        const totalKB = (totalBytes / 1024).toFixed(1);
        const percentage = Math.min(100, (totalKB / 5120) * 100).toFixed(1);

        const storageUsageText = document.getElementById("storageUsageText");
        const storageBarFill = document.getElementById("storageBarFill");
        if (storageUsageText) storageUsageText.textContent = `${totalKB} KB used`;
        if (storageBarFill) storageBarFill.style.width = `${percentage}%`;
    } catch (e) {
        console.error("Storage calc error:", e);
    }

    // 2. Trash UI Update
    const trashCountText = document.getElementById("trashCountText");
    if (trashCountText && typeof trashBin !== 'undefined') {
        trashCountText.textContent = `${trashBin.length} items in trash`;
    }
}

// Settings buttons
const settingsExportBtn = document.getElementById("settingsExportBtn");
if (settingsExportBtn) {
    settingsExportBtn.addEventListener("click", () => {
        const exportBtn = document.getElementById("exportBackupBtn");
        if (exportBtn) exportBtn.click();
    });
}

const settingsResetBtn = document.getElementById("settingsResetBtn");
if (settingsResetBtn) {
    settingsResetBtn.addEventListener("click", async () => {
        const confirmed = typeof showCustomConfirm === 'function'
            ? await showCustomConfirm("⚠️ Factory Reset", "This will permanently delete all local projects and reset settings. Proceed?")
            : confirm("This will permanently delete all local projects and reset settings. Proceed?");
            
        if (confirmed) {
            localStorage.clear();
            window.location.reload();
        }
    });
}
// Helper: Update Auth UI based on user session status
function updateAuthUI(user) {
    if (user && user.emailVerified) {
        syncProfileAndHideModal(user);
    } else {
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('hidden');
    }
}

// ========================================
// TOAST NOTIFICATIONS & GLOBAL HELPERS
// ========================================

function showToast(message, isSuccess = true) {
    let toast = document.querySelector(".wolf-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "wolf-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = isSuccess ? "#166534" : "#b91c1c";
    setTimeout(() => toast.classList.add("show"), 50);
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ========================================
// EMAIL FEEDBACK DISPATCHER
// ========================================

const feedbackForm = $("#feedbackForm");
const feedbackInput = $("#feedbackInput");
const feedbackUserEmail = $("#feedbackUserEmail");
const sendFeedbackBtn = $("#sendFeedbackBtn");

if (feedbackForm) {
    feedbackForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const feedbackText = feedbackInput.value.trim();
        const userEmail = feedbackUserEmail ? feedbackUserEmail.value.trim() : "Anonymous";

        if (!feedbackText) {
            showToast("⚠️ Please enter your feedback message first.", false);
            return;
        }

        const originalBtnText = sendFeedbackBtn.textContent;
        sendFeedbackBtn.textContent = "Sending...";
        sendFeedbackBtn.disabled = true;

        // TARGET DEVELOPER EMAIL
        const developerEmail = "asmoke970@gmail.com"; // <-- REPLACE WITH YOUR EMAIL ADDRESS

        // 1. Optional API Endpoint (e.g., Formspree/Web3Forms)
        const FORM_ENDPOINT = ""; // <-- Add Formspree URL here (e.g. https://formspree.io/f/xyza...)

        if (FORM_ENDPOINT) {
            try {
                const response = await fetch(FORM_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: userEmail,
                        message: feedbackText,
                        _subject: "Wolf Workspace User Feedback"
                    })
                });

                if (response.ok) {
                    showToast("🚀 Feedback sent successfully to developer!");
                    feedbackForm.reset();
                } else {
                    throw new Error("API dispatch failed");
                }
            } catch (err) {
                console.warn("Direct API failed, switching to mailto fallback...", err);
                triggerMailtoFallback(developerEmail, userEmail, feedbackText);
            }
        } else {
            // 2. Direct Mailto Fallback
            triggerMailtoFallback(developerEmail, userEmail, feedbackText);
        }

        sendFeedbackBtn.textContent = originalBtnText;
        sendFeedbackBtn.disabled = false;
    });
}

function triggerMailtoFallback(destEmail, senderEmail, text) {
    const subject = encodeURIComponent("Wolf Workspace Feedback / Bug Report");
    const body = encodeURIComponent(`Sender Email: ${senderEmail}\n\nFeedback:\n${text}`);
    
    window.location.href = `mailto:${destEmail}?subject=${subject}&body=${body}`;
    showToast("📬 Opening mail client to dispatch feedback...");
    feedbackForm.reset();
}

//========================================
// POWER-USER KEYBOARD SHORTCUTS
// ========================================

document.addEventListener("keydown", (event) => {
// Avoid triggering shortcuts if the user is currently typing inside an input, textarea, or select
const activeTagName = document.activeElement?.tagName?.toLowerCase() || "";
const isTyping = activeTagName === "input" || activeTagName === "textarea" || activeTagName === "select";

// 1. ESCAPE KEY: Close any open modals or sidebars  
if (event.key === "Escape") {  
    // Close sidebar if open  
    if (typeof closeSidebar === "function") {  
        closeSidebar();  
    }  
      
    // Close any active modals  
    const modals = document.querySelectorAll(".modal");  
    modals.forEach(modal => modal.classList.add("hidden"));  

    // Blur search or active inputs if needed  
    if (document.activeElement) {  
        document.activeElement.blur();  
    }  
    return;  
}  

// Do not trigger single-letter shortcuts if user is typing  
if (isTyping) return;  

// 2. '/' or 'Ctrl + K': Focus the Global Search Bar  
if (event.key === "/" || (event.ctrlKey && event.key.toLowerCase() === "k")) {  
    event.preventDefault();  
    const searchInput = $("#globalSearchInput");  
    if (searchInput) {  
        // If we are currently inside a project workspace, go back to dashboard first to search globally  
        if (dashboardView && dashboardView.classList.contains("hidden")) {  
            if (typeof showDashboard === "function") {  
                showDashboard();  
            }  
        }  
        searchInput.focus();  
        searchInput.select();  
        showToast("🔍 Global search focused");  
    }  
}  

// 3. 'n' or 'N': Focus the New Project input field  
if (typeof event.key === "string" && event.key.toLowerCase() === "n") {  
    event.preventDefault();  
    const projectNameInput = $("#projectName");  
    if (projectNameInput) {  
        // Ensure we are on the dashboard view  
        if (dashboardView && dashboardView.classList.contains("hidden")) {  
            if (typeof showDashboard === "function") {  
                showDashboard();  
            }  
        }  
        projectNameInput.focus();  
        showToast("➕ New project input focused");  
    }  
}

});
// ========================================
// SHORTCUTS MODAL CONTROLLER
// ========================================

const shortcutsModal = $("#shortcutsModal");
const openShortcutsModalBtn = $("#openShortcutsModal");
const closeShortcutsModalBtn = $("#closeShortcutsModal");
const closeShortcutsBtn = $("#closeShortcutsBtn");

if (openShortcutsModalBtn && shortcutsModal) {
openShortcutsModalBtn.addEventListener("click", () => {
shortcutsModal.classList.remove("hidden");
});
}

const closeShortcuts = () => {
if (shortcutsModal) shortcutsModal.classList.add("hidden");
};

if (closeShortcutsModalBtn) closeShortcutsModalBtn.addEventListener("click", closeShortcuts);
if (closeShortcutsBtn) closeShortcutsBtn.addEventListener("click", closeShortcuts);

if (shortcutsModal) {
shortcutsModal.addEventListener("click", (e) => {
if (e.target === shortcutsModal) closeShortcuts();
});
}


// ========================================
// REFINED WORKSPACE BACKUP & RESTORE SYSTEM
// ========================================

const exportBackupBtn = $("#exportBackupBtn");
const importBackupInput = $("#importBackupInput");

// 1. EXPORT REFINED BACKUP AS JSON FILE
if (exportBackupBtn) {
exportBackupBtn.addEventListener("click", () => {
try {
// Calculate total tasks and notes across all projects for summary stats
let totalTasksCount = 0;
let totalNotesCount = 0;

projects.forEach(project => {  
            if (project.tasks) totalTasksCount += project.tasks.length;  
            if (project.notes) totalNotesCount += project.notes.length;  
        });  

        const dataToExport = {  
            app: "Wolf Workspace",  
            version: "1.1",  
            exportDate: new Date().toLocaleDateString("en-US", {  
                year: "numeric",  
                month: "long",  
                day: "numeric",  
                hour: "2-digit",  
                minute: "2-digit"  
            }),  
            summary: {  
                totalProjects: projects.length,  
                totalTasks: totalTasksCount,  
                totalNotes: totalNotesCount  
            },  
            projects: projects  
        };  

        const jsonString = JSON.stringify(dataToExport, null, 2);  
        const blob = new Blob([jsonString], { type: "application/json" });  
        const url = URL.createObjectURL(blob);  

        const downloadLink = document.createElement("a");  
        downloadLink.href = url;  
        downloadLink.download = `wolf-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;  
          
        document.body.appendChild(downloadLink);  
        downloadLink.click();  
        document.body.removeChild(downloadLink);  
        URL.revokeObjectURL(url);  

        showToast("📥 Refined workspace backup exported successfully!");  
    } catch (error) {  
        console.error("Export failed:", error);  
        showToast("Failed to export backup.", false);  
    }  
});

}

// 2. IMPORT / RESTORE BACKUP FROM JSON FILE
if (importBackupInput) {
importBackupInput.addEventListener("change", (event) => {
const file = event.target.files[0];
if (!file) return;

const reader = new FileReader();  
    reader.onload = (e) => {  
        try {  
            const parsedData = JSON.parse(e.target.result);  

            if (!parsedData.projects || !Array.isArray(parsedData.projects)) {  
                throw new Error("Invalid backup format.");  
            }  

            if (showCustomConfirm("⚠️ Restoring a backup will overwrite your current workspace projects and tasks. Do you want to proceed?")) {  
                projects = parsedData.projects;  
                saveProjects();  
                renderDashboard();  
                  
                // If we are currently inside a project workspace, return to dashboard or refresh  
                if (typeof showDashboard === "function") {  
                    showDashboard();  
                }  

                showToast("📤 Workspace restored successfully!");  
            }  
        } catch (error) {  
            console.error("Import failed:", error);  
            showToast("Invalid backup file format.", false);  
        } finally {  
            // Reset file input so the same file can be selected again if needed  
            importBackupInput.value = "";  
        }  
    };  

    reader.readAsText(file);  
});

}

// ========================================
// TRASH BIN RECOVERY SYSTEM
// ========================================

const trashModal = $("#trashModal");
const closeTrashModal = $("#closeTrashModal");
const closeTrashBtn = $("#closeTrashBtn");
const viewTrashBtn = $("#viewTrashBtn");
const emptyTrashBtn = $("#emptyTrashBtn");
const modalEmptyTrashBtn = $("#modalEmptyTrashBtn");
const trashItemsList = $("#trashItemsList");

let trashBin = JSON.parse(localStorage.getItem(getUserStorageKey("trash"))) || [];


// Function to save trash bin locally
function saveTrash() {
    localStorage.setItem(getUserStorageKey("trash"), JSON.stringify(trashBin));
    updateTrashUI();
}
// Function to load trash bin
function loadTrash() {
    trashBin = JSON.parse(localStorage.getItem(getUserStorageKey("trash"))) || [];
    return trashBin;
}
function updateTrashUI() {
    const trashCountText = $("#trashCountText");
    if (trashCountText) {
        trashCountText.textContent = `${trashBin.length} ${trashBin.length === 1 ? "item" : "items"} in trash`;
    }
}

// Push deleted item into trash bin
function moveItemToTrash(type, item) {
    trashBin.push({
        trashId: Date.now().toString(),
        type: type, // "project", "task", or "note"
        data: item,
        deletedAt: new Date().toLocaleDateString()
    });
    saveTrash();
}

// Render list of deleted items inside trash modal
function renderTrashModal() {
    if (!trashItemsList) return;
    trashItemsList.replaceChildren();

    if (trashBin.length === 0) {
        trashItemsList.appendChild(
            createElement("div", "empty-state", "📭 Trash bin is clean and empty.")
        );
        return;
    }

    trashBin.forEach(entry => {
        const card = createElement("div", "trash-item-card");

        const info = createElement("div", "trash-item-info");
        const titleText = entry.data.name || entry.data.title || entry.data.text || "Unnamed Item";
        const title = createElement("span", "trash-item-title", `[${entry.type.toUpperCase()}] ${titleText}`);
        const meta = createElement("span", "trash-item-meta", `Deleted on ${entry.deletedAt}`);
        info.append(title, meta);

        const actions = createElement("div", "trash-item-actions");
        
        // Restore Button
        const restoreBtn = createButton("↺ Restore", "restore-btn", () => {
            restoreItemFromTrash(entry.trashId);
        });

        // Permanent Delete Button
        const permDeleteBtn = createButton("Delete", "file-delete-btn", () => {
            trashBin = trashBin.filter(item => item.trashId !== entry.trashId);
            saveTrash();
            renderTrashModal();
            showToast("💥 Item permanently deleted.");
        });

        actions.append(restoreBtn, permDeleteBtn);
        card.append(info, actions);
        trashItemsList.appendChild(card);
    });
}

// ========================================
// REFINED TRASH RESTORE SYSTEM
// ========================================

function restoreItemFromTrash(trashId) {
    const entry = trashBin.find(item => item.trashId === trashId);
    if (!entry) return;

    // Extract the original item data from the trash wrapper
    const originalData = entry.data;

    if (entry.type === "project") {
        // Restore project directly to dashboard list
        projects.push(originalData);
        saveProjects();
        renderDashboard();
    } 
    else if (entry.type === "task" || entry.type === "note" || entry.type === "file") {
        let project = getActiveProject();

        // If no project is currently open, attempt to restore to the first available project or ask
        if (!project) {
            if (projects.length > 0) {
                project = projects[0]; // Default fallback to first project
                activeProjectId = project.id;
            } else {
                showToast("⚠️ Create or open a project first to restore this item.", false);
                return;
            }
        }

        if (entry.type === "task") {
            if (!Array.isArray(project.tasks)) project.tasks = [];
            project.tasks.push(originalData);
        } 
        else if (entry.type === "note") {
            if (!Array.isArray(project.notes)) project.notes = [];
            project.notes.push(originalData);
        }
        else if (entry.type === "file") {
            if (!Array.isArray(project.files)) project.files = [];
            project.files.push(originalData);
        }

        saveProjects();
        
        // If workspace is active, refresh it
        if (typeof renderWorkspace === "function" && projectWorkspace && !projectWorkspace.classList.contains("hidden")) {
            renderWorkspace();
            if (entry.type === "file" && typeof renderFiles === "function") renderFiles();
        }
    }

    // Remove item from trash bin
    trashBin = trashBin.filter(item => item.trashId !== trashId);
    saveTrash();
    renderTrashModal();
    
    showToast(`↺ Restored successfully!`);
}

// Open Trash Modal
if (viewTrashBtn) {
    viewTrashBtn.addEventListener("click", () => {
        renderTrashModal();
        if (trashModal) trashModal.classList.remove("hidden");
    });
}

// Empty Trash Action (Settings & Modal)
const handleEmptyTrash = async () => {
    if (trashBin.length === 0) {
        showToast("🗑️ Trash bin is already empty.");
        return;
    }

    const confirmed = await showCustomConfirm(
        "🗑️ Empty Trash Bin",
        "This will permanently remove all items in the trash. This cannot be undone."
    );

    if (confirmed) {
        trashBin = [];
        saveTrash();
        renderTrashModal();
        showToast("💥 Trash bin emptied permanently.");
    }
};
// ========================================
// TRASH BIN MODAL CLOSE HANDLERS
// ========================================

const closeTrashWindow = () => { 
    const trashModal = $("#trashModal");
    if (trashModal) {
        trashModal.classList.add("hidden");
    }
};

// Bind explicit listeners to the trash modal close buttons
const closeTrashModalBtn = $("#closeTrashModal");

if (closeTrashModalBtn) {
    closeTrashModalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeTrashWindow();
    });
}

if (closeTrashBtn) {
    closeTrashBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeTrashWindow();
    });
}

// Ensure clicking outside the trash modal content closes it safely
const trashModalEl = $("#trashModal");
if (trashModalEl) {
    trashModalEl.addEventListener("click", (e) => {
        if (e.target === trashModalEl) {
            closeTrashWindow();
        }
    });
}

if (emptyTrashBtn) emptyTrashBtn.addEventListener("click", handleEmptyTrash);
if (modalEmptyTrashBtn) modalEmptyTrashBtn.addEventListener("click", handleEmptyTrash);

// ========================================
// MARKDOWN PARSER & LIVE PREVIEW SYSTEM
// ========================================

const writeTabBtn = $("#writeTabBtn");
const previewTabBtn = $("#previewTabBtn");
const noteContentInput = $("#noteContent");
const notePreviewPane = $("#notePreviewPane");

// Lightweight secure Markdown parser
function parseMarkdown(markdown) {
    if (!markdown) return "";
    let html = markdown
        // Escape basic HTML entities to prevent XSS
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Code blocks
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        // Inline code
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // Headers
        .replace(/^### (.*$)/gm, "<h3>$1</h3>")
        .replace(/^## (.*$)/gm, "<h2>$1</h2>")
        .replace(/^# (.*$)/gm, "<h1>$1</h1>")
        // Bold
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        // Italic
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        // Bullet points
        .replace(/^\* (.*$)/gm, "<li>$1</li>")
        // Line breaks
        .replace(/\n/g, "<br>");

    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>");
    return html;
}

// Tab Switcher Event Listeners
if (writeTabBtn && previewTabBtn && noteContentInput && notePreviewPane) {
    writeTabBtn.addEventListener("click", () => {
        writeTabBtn.style.background = "var(--accent)";
        writeTabBtn.style.color = "#07111f";
        previewTabBtn.style.background = "transparent";
        previewTabBtn.style.color = "var(--text)";

        noteContentInput.classList.remove("hidden");
        notePreviewPane.classList.add("hidden");
    });

    previewTabBtn.addEventListener("click", () => {
        previewTabBtn.style.background = "var(--accent)";
        previewTabBtn.style.color = "#07111f";
        writeTabBtn.style.background = "transparent";
        writeTabBtn.style.color = "var(--text)";

        // Render live markdown preview
        const rawText = noteContentInput.value;
        notePreviewPane.innerHTML = parseMarkdown(rawText) || "<em style='color: var(--muted);'>Nothing to preview yet.</em>";

        noteContentInput.classList.add("hidden");
        notePreviewPane.classList.remove("hidden");
    });
}

// ========================================
// KANBAN BOARD & VIEW SWITCHER SYSTEM (Refined)
// ========================================

const tasksListViewBtn = $("#tasksListViewBtn");
const tasksKanbanViewBtn = $("#tasksKanbanViewBtn");
const workspaceKanbanBoard = $("#workspaceKanbanBoard");
const projectProgressCard = document.querySelector(".progress-card");

let activeTaskView = "list"; // "list" or "kanban"

if (tasksListViewBtn && tasksKanbanViewBtn) {
    tasksListViewBtn.addEventListener("click", () => {
        activeTaskView = "list";
        tasksListViewBtn.style.background = "var(--accent)";
        tasksListViewBtn.style.color = "#07111f";
        tasksKanbanViewBtn.style.background = "transparent";
        tasksKanbanViewBtn.style.color = "var(--text)";

        // Show List, Progress Bar, and Add Task Form
        if (workspaceTaskList) workspaceTaskList.classList.remove("hidden");
        if (projectProgressCard) projectProgressCard.classList.remove("hidden");
        if (workspaceTaskForm) workspaceTaskForm.classList.remove("hidden");

        // Hide Kanban Board
        if (workspaceKanbanBoard) workspaceKanbanBoard.classList.add("hidden");
        
        renderTasks();
    });

    tasksKanbanViewBtn.addEventListener("click", () => {
        activeTaskView = "kanban";
        tasksKanbanViewBtn.style.background = "var(--accent)";
        tasksKanbanViewBtn.style.color = "#07111f";
        tasksListViewBtn.style.background = "transparent";
        tasksListViewBtn.style.color = "var(--text)";

        // Hide List, Progress Bar, and Add Task Form
        if (workspaceTaskList) workspaceTaskList.classList.add("hidden");
        if (projectProgressCard) projectProgressCard.classList.add("hidden");
        if (workspaceTaskForm) workspaceTaskForm.classList.add("hidden");

        // Show Kanban Board
        if (workspaceKanbanBoard) workspaceKanbanBoard.classList.remove("hidden");
        
        renderKanban();
    });
}

// Unified render router for tasks
function renderTasks() {
    if (activeTaskView === "kanban") {
        renderKanban();
        return;
    }

    // Standard List View render
    workspaceTaskList.replaceChildren();
    const project = getActiveProject();
    if (!project) return;

    if (project.tasks.length === 0) {
        workspaceTaskList.appendChild(createElement("div", "empty-state", "No tasks yet. Add your first task above."));
        return;
    }

    const today = new Date();
    const todayString = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    project.tasks.forEach(task => {
        const item = createElement("article", task.completed ? "task-item completed" : "task-item");

        const checkbox = createElement("input", "task-checkbox");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            task.status = checkbox.checked ? "completed" : "todo";
            saveProjects();
            renderTasks();
            updateProjectProgress();
            renderDashboard();
        });

        const content = createElement("div", "task-item-content");
        content.appendChild(createElement("div", "task-description", task.text));

        const priority = ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium";
        content.appendChild(createElement("span", `task-priority priority-${priority}`, priority.toUpperCase() + " PRIORITY"));

        if (task.dueDate) {
            const deadline = createElement("div", "task-deadline");
            deadline.textContent = `📅 Due: ${task.dueDate}`;
            if (!task.completed && task.dueDate < todayString) {
                deadline.classList.add("task-overdue");
                deadline.textContent += " — OVERDUE";
            } else if (!task.completed && task.dueDate === todayString) {
                deadline.classList.add("task-due-today");
                deadline.textContent += " — DUE TODAY";
            }
            content.appendChild(deadline);
        }

        const actions = createElement("div", "task-actions");
        actions.append(
            createButton("Edit", "edit-task-button", () => openEditTaskModal(task.id)),
            createButton("Delete", "delete-task-button", () => openDeleteTaskModal(task.id))
        );

        item.append(checkbox, content, actions);
        workspaceTaskList.appendChild(item);
    });
}

// Render Kanban Columns
function renderKanban() {
    const todoCol = $("#kanbanTodoColumn");
    const inProgressCol = $("#kanbanInProgressColumn");
    const completedCol = $("#kanbanCompletedColumn");
    const todoCount = $("#todoCount");
    const inProgressCount = $("#inProgressCount");
    const completedCount = $("#completedCount");

    if (!todoCol || !inProgressCol || !completedCol) return;

    todoCol.replaceChildren();
    inProgressCol.replaceChildren();
    completedCol.replaceChildren();

    const project = getActiveProject();
    if (!project) return;

    const tasks = project.tasks || [];
    const todoTasks = tasks.filter(t => t.status === "todo" || !t.status);
    const inProgressTasks = tasks.filter(t => t.status === "in-progress");
    const completedTasks = tasks.filter(t => t.status === "completed" || t.completed);

    if (todoCount) todoCount.textContent = todoTasks.length;
    if (inProgressCount) inProgressCount.textContent = inProgressTasks.length;
    if (completedCount) completedCount.textContent = completedTasks.length;

    // Helper to populate column cards
    const populateColumn = (container, taskList, targetStatus) => {
        if (taskList.length === 0) {
            container.appendChild(createElement("div", "empty-state", "No tasks"));
            return;
        }

        taskList.forEach(task => {
            const card = createElement("div", "kanban-task-card");
            
            const header = createElement("div", "kanban-card-header");
            const text = createElement("span", "kanban-card-text", task.text);
            const priority = ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium";
            const badge = createElement("span", `task-priority priority-${priority}`, priority.toUpperCase());
            
            header.append(text, badge);
            card.appendChild(header);

            // Footer controls to shift task columns
            const footer = createElement("div", "kanban-card-footer");
            
            // Move left / previous button
            if (targetStatus === "in-progress") {
                const moveBack = createButton("← To Do", "kanban-move-btn", () => {
                    task.status = "todo";
                    task.completed = false;
                    saveProjects();
                    renderKanban();
                    updateProjectProgress();
                });
                footer.appendChild(moveBack);
            } else if (targetStatus === "completed") {
                const moveBack = createButton("← In Progress", "kanban-move-btn", () => {
                    task.status = "in-progress";
                    task.completed = false;
                    saveProjects();
                    renderKanban();
                    updateProjectProgress();
                });
                footer.appendChild(moveBack);
            } else {
                footer.appendChild(createElement("span", "", task.dueDate ? `📅 ${task.dueDate}` : ""));
            }

            // Move right / next button
            if (targetStatus === "todo") {
                const moveForward = createButton("In Progress →", "kanban-move-btn", () => {
                    task.status = "in-progress";
                    task.completed = false;
                    saveProjects();
                    renderKanban();
                    updateProjectProgress();
                });
                footer.appendChild(moveForward);
            } else if (targetStatus === "in-progress") {
                const moveForward = createButton("Complete ✓", "kanban-move-btn", () => {
                    task.status = "completed";
                    task.completed = true;
                    saveProjects();
                    renderKanban();
                    updateProjectProgress();
                    renderDashboard();
                });
                footer.appendChild(moveForward);
            } else {
                // Delete button for completed column
                const delBtn = createButton("Delete", "file-delete-btn", () => {
                    openDeleteTaskModal(task.id);
                });
                delBtn.style.padding = "2px 6px";
                delBtn.style.fontSize = "0.7rem";
                footer.appendChild(delBtn);
            }

            card.appendChild(footer);
            container.appendChild(card);
        });
    };

    populateColumn(todoCol, todoTasks, "todo");
    populateColumn(inProgressCol, inProgressTasks, "in-progress");
    populateColumn(completedCol, completedTasks, "completed");
}

// ========================================
// POMODORO FOCUS TIMER SYSTEM
// ========================================

const pomoTimerDisplay = $("#pomoTimerDisplay");
const pomoStartBtn = $("#pomoStartBtn");
const pomoPauseBtn = $("#pomoPauseBtn");
const pomoResetBtn = $("#pomoResetBtn");
const pomoFocusModeBtn = $("#pomoFocusModeBtn");
const pomoBreakModeBtn = $("#pomoBreakModeBtn");
const pomoModeBadge = $("#pomoModeBadge");

let pomoTimerInterval = null;
let pomoCurrentMode = "focus"; // "focus" or "break"
let pomoTimeRemaining = 25 * 60; // default 25 minutes in seconds

function updatePomoDisplay() {
    if (!pomoTimerDisplay) return;
    const minutes = Math.floor(pomoTimeRemaining / 60);
    const seconds = pomoTimeRemaining % 60;
    pomoTimerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startPomoTimer() {
    if (pomoTimerInterval) return;

    pomoTimerInterval = setInterval(() => {
        if (pomoTimeRemaining > 0) {
            pomoTimeRemaining--;
            updatePomoDisplay();
        } else {
            clearInterval(pomoTimerInterval);
            pomoTimerInterval = null;

            if (pomoStartBtn && pomoPauseBtn) {
                pomoStartBtn.classList.remove("hidden");
                pomoPauseBtn.classList.add("hidden");
            }

            if (pomoCurrentMode === "focus") {
                showToast("🔔 Focus session complete! Time to take a 5-minute break.");
                setPomoMode("break");
            } else {
                showToast("⚡ Break time over! Back into focus mode.");
                setPomoMode("focus");
            }
        }
    }, 1000);

    if (pomoStartBtn && pomoPauseBtn) {
        pomoStartBtn.classList.add("hidden");
        pomoPauseBtn.classList.remove("hidden");
    }
}

function pausePomoTimer() {
    if (pomoTimerInterval) {
        clearInterval(pomoTimerInterval);
        pomoTimerInterval = null;
    }
    if (pomoStartBtn && pomoPauseBtn) {
        pomoStartBtn.classList.remove("hidden");
        pomoPauseBtn.classList.add("hidden");
    }
}

function resetPomoTimer() {
    pausePomoTimer();
    pomoTimeRemaining = pomoCurrentMode === "focus" ? 25 * 60 : 5 * 60;
    updatePomoDisplay();
}

function setPomoMode(mode) {
    pausePomoTimer();
    pomoCurrentMode = mode;

    if (mode === "focus") {
        pomoTimeRemaining = 25 * 60;
        if (pomoModeBadge) pomoModeBadge.textContent = "25M FOCUS";
        if (pomoFocusModeBtn) {
            pomoFocusModeBtn.style.background = "var(--accent)";
            pomoFocusModeBtn.style.color = "#07111f";
        }
        if (pomoBreakModeBtn) {
            pomoBreakModeBtn.style.background = "transparent";
            pomoBreakModeBtn.style.color = "var(--text)";
        }
    } else {
        pomoTimeRemaining = 5 * 60;
        if (pomoModeBadge) pomoModeBadge.textContent = "5M BREAK";
        if (pomoBreakModeBtn) {
            pomoBreakModeBtn.style.background = "var(--accent)";
            pomoBreakModeBtn.style.color = "#07111f";
        }
        if (pomoFocusModeBtn) {
            pomoFocusModeBtn.style.background = "transparent";
            pomoFocusModeBtn.style.color = "var(--text)";
        }
    }

    updatePomoDisplay();
}

if (pomoStartBtn) pomoStartBtn.addEventListener("click", startPomoTimer);
if (pomoPauseBtn) pomoPauseBtn.addEventListener("click", pausePomoTimer);
if (pomoResetBtn) pomoResetBtn.addEventListener("click", resetPomoTimer);

if (pomoFocusModeBtn) pomoFocusModeBtn.addEventListener("click", () => setPomoMode("focus"));
if (pomoBreakModeBtn) pomoBreakModeBtn.addEventListener("click", () => setPomoMode("break"));
// ========================================
// QUICK CAPTURE FLOATING SYSTEM
// ========================================

const quickCaptureFab = $("#quickCaptureFab");
const quickCaptureModal = $("#quickCaptureModal");
const closeQuickCaptureModal = $("#closeQuickCaptureModal");
const cancelQuickCapture = $("#cancelQuickCapture");
const quickCaptureForm = $("#quickCaptureForm");
const quickCaptureType = $("#quickCaptureType");
const quickCaptureTargetProject = $("#quickCaptureTargetProject");
const quickCaptureTitle = $("#quickCaptureTitle");
const quickCaptureBody = $("#quickCaptureBody");
const quickCaptureNoteBodyGroup = $("#quickCaptureNoteBodyGroup");

function populateQuickCaptureProjects() {
    if (!quickCaptureTargetProject) return;
    quickCaptureTargetProject.replaceChildren();

    if (projects.length === 0) {
        const opt = createElement("option", "", "No active projects available");
        opt.value = "";
        quickCaptureTargetProject.appendChild(opt);
        return;
    }

    // Bulletproof array check for the quick capture dropdown
const safeProjects = Array.isArray(projects) ? projects : (projects ? Object.values(projects) : []);

safeProjects.forEach(project => {
    const opt = createElement("option", "", project.name);
    opt.value = project.id;
    if (project.id === activeProjectId) opt.selected = true;
    quickCaptureTargetProject.appendChild(opt);
});

}

function openQuickCapture() {
    if (projects.length === 0) {
        showToast("⚠️ Please create at least one project first.", false);
        return;
    }
    populateQuickCaptureProjects();
    if (quickCaptureModal) quickCaptureModal.classList.remove("hidden");
    if (quickCaptureTitle) quickCaptureTitle.focus();
}

if (quickCaptureFab) quickCaptureFab.addEventListener("click", openQuickCapture);
if (closeQuickCaptureModal) closeQuickCaptureModal.addEventListener("click", closeQuickCapture);
if (cancelQuickCapture) cancelQuickCapture.addEventListener("click", closeQuickCapture);

if (quickCaptureType) {
    quickCaptureType.addEventListener("change", (e) => {
        if (e.target.value === "note") {
            quickCaptureNoteBodyGroup.classList.remove("hidden");
        } else {
            quickCaptureNoteBodyGroup.classList.add("hidden");
        }
    });
}

if (quickCaptureForm) {
    quickCaptureForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const targetId = quickCaptureTargetProject.value;
        const project = projects.find(p => p.id === targetId);
        
        if (!project) {
            showToast("Target project not found.", false);
            return;
        }

        const type = quickCaptureType.value;
        const titleText = quickCaptureTitle.value.trim();
        const bodyText = quickCaptureBody ? quickCaptureBody.value.trim() : "";

        if (type === "task") {
            if (!Array.isArray(project.tasks)) project.tasks = [];
            project.tasks.push({
                id: createId(),
                text: titleText,
                completed: false,
                status: "todo",
                priority: "medium",
                dueDate: ""
            });
            showToast(`📋 Task added to "${project.name}"!`);
        } else {
            if (!Array.isArray(project.notes)) project.notes = [];
            project.notes.push({
                id: createId(),
                title: titleText,
                content: bodyText || "Quick captured note.",
                category: "General",
                tags: ["quick-capture"],
                updatedAt: Date.now()
            });
            showToast(`📝 Note added to "${project.name}"!`);
        }

        saveProjects();
        closeQuickCapture();

        if (activeProjectId === project.id && typeof renderWorkspace === "function") {
            renderWorkspace();
        }
        renderDashboard();
    });
}

// ========================================
// GLOBAL COMMAND PALETTE SYSTEM
// ========================================

const commandPaletteModal = $("#commandPaletteModal");
const cmdInput = $("#cmdInput");
const cmdResultsList = $("#cmdResultsList");

const commandRegistry = [
    { title: "🏠 Go to Dashboard", category: "Navigation", shortcut: "Esc", action: () => showDashboard() },
    { title: "➕ Create New Project", category: "Actions", shortcut: "N", action: () => { showDashboard(); $("#projectName")?.focus(); } },
    { title: "⚡ Quick Capture", category: "Actions", shortcut: "Shift+N", action: () => openQuickCapture() },
    { title: "🎨 Theme: Wolf Cyber", category: "Theme", shortcut: "", action: () => { applyTheme("wolf-cyber"); if (themeSelect) themeSelect.value = "wolf-cyber"; } },
    { title: "🐍 Theme: Emerald Hacker", category: "Theme", shortcut: "", action: () => { applyTheme("emerald-hacker"); if (themeSelect) themeSelect.value = "emerald-hacker"; } },
    { title: "🩸 Theme: Crimson Alpha", category: "Theme", shortcut: "", action: () => { applyTheme("crimson-alpha"); if (themeSelect) themeSelect.value = "crimson-alpha"; } },
    { title: "📥 Export Backup JSON", category: "Data", shortcut: "", action: () => $("#exportBackupBtn")?.click() },
    { title: "🗑️ View Trash Bin", category: "Data", shortcut: "", action: () => $("#viewTrashBtn")?.click() },
    { title: "⌨️ View Keyboard Shortcuts", category: "Help", shortcut: "?", action: () => $("#shortcutsModal")?.classList.remove("hidden") },
    { title: "⚡ Open Command Palette", category: "Actions", shortcut: "Ctrl+Shift+P", action: () => openCommandPalette() }
];

function openCommandPalette() {
    if (!commandPaletteModal) return;
    commandPaletteModal.classList.remove("hidden");
    if (cmdInput) {
        cmdInput.value = "";
        cmdInput.focus();
    }
    renderCommandResults("");
}

function closeCommandPalette() {
    if (commandPaletteModal) commandPaletteModal.classList.add("hidden");
}

function renderCommandResults(filterText = "") {
    if (!cmdResultsList) return;
    cmdResultsList.replaceChildren();

    const query = filterText.toLowerCase().trim();
    const filteredCmds = commandRegistry.filter(cmd => 
        cmd.title.toLowerCase().includes(query) || cmd.category.toLowerCase().includes(query)
    );

    if (filteredCmds.length === 0) {
        cmdResultsList.appendChild(createElement("div", "empty-state", "No matching commands found."));
        return;
    }

    filteredCmds.forEach(cmd => {
        const item = createElement("div", "cmd-item");
        const titleSpan = createElement("span", "", cmd.title);
        item.appendChild(titleSpan);

        if (cmd.shortcut) {
            const badge = createElement("span", "cmd-shortcut-badge", cmd.shortcut);
            item.appendChild(badge);
        }

        item.addEventListener("click", () => {
            closeCommandPalette();
            cmd.action();
        });

        cmdResultsList.appendChild(item);
    });
}

if (cmdInput) {
    cmdInput.addEventListener("input", (e) => renderCommandResults(e.target.value));
}

// Global Keyboard Trigger for Command Palette (Ctrl+Shift+P or Cmd+Shift+P) & Shift+N Quick Capture
document.addEventListener("keydown", (e) => {
    // 1. Command Palette Trigger: Ctrl+Shift+P or Cmd+Shift+P
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        openCommandPalette();
        return;
    }

    // 2. Quick Capture Trigger: Shift+N (when not inside typing inputs)
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    const isTyping = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

    if (!isTyping && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openQuickCapture();
        return;
    }
});

if (commandPaletteModal) {
    commandPaletteModal.addEventListener("click", (e) => {
        if (e.target === commandPaletteModal) closeCommandPalette();
    });
}
// ========================================
// FIXED MODAL & VIEW UTILITIES
// ========================================

// 1. Properly hoisted function for Quick Capture close
function closeQuickCapture() {
    const quickCaptureModal = document.getElementById("quickCaptureModal");
    if (quickCaptureModal) {
        quickCaptureModal.classList.add("hidden");
    }
    const quickCaptureForm = document.getElementById("quickCaptureForm");
    if (quickCaptureForm) quickCaptureForm.reset();
    
    const quickCaptureNoteBodyGroup = document.getElementById("quickCaptureNoteBodyGroup");
    if (quickCaptureNoteBodyGroup) quickCaptureNoteBodyGroup.classList.add("hidden");
}

// 2. Properly hoisted function for Universal View Switching
function showOnlyView(targetViewId) {
    const allContainers = [
        'dashboardView', 
        'projectWorkspace', 
        'tasksSection', 
        'notesSection', 
        'filesSection', 
        'settingsView', 
        'trashModal', 
        'quickCaptureModal',
        'authModal'
    ];

    allContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === targetViewId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}
// ========================================
// ROBUST MAIN VIEW & SETTINGS SWITCHER
// ========================================

function showOnlyMainView(targetViewId) {
    const dashboardView = document.getElementById('dashboardView');
    const projectWorkspace = document.getElementById('projectWorkspace');
    const exportView = document.getElementById('exportView');

    // Hide all primary top-level views first
    [dashboardView, projectWorkspace, exportView].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    if (targetViewId === 'dashboardView' && dashboardView) {
        dashboardView.classList.remove('hidden');
    } else if (targetViewId === 'settingsView') {
        // Settings belongs inside the workspace wrapper layout
        if (projectWorkspace) projectWorkspace.classList.remove('hidden');
        if (typeof showWorkspaceSection === 'function') {
            showWorkspaceSection('settings');
        }
    } else if (targetViewId === 'projectWorkspace' && projectWorkspace) {
        projectWorkspace.classList.remove('hidden');
    }
}
// ========================================
// WOLF WORKSPACE — PASSWORD RECOVERY & AUTH SYSTEM
// ========================================

const showForgotBtn = document.getElementById('showForgotBtn');
const backToLoginFromForgotBtn = document.getElementById('backToLoginFromForgotBtn');
const forgotPasswordView = document.getElementById('forgotPasswordView');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');

if (showForgotBtn) {
    showForgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginView')?.classList.add('hidden');
        document.getElementById('signupView')?.classList.add('hidden');
        document.getElementById('verifyView')?.classList.add('hidden');
        forgotPasswordView?.classList.remove('hidden');
    });
}

if (backToLoginFromForgotBtn) {
    backToLoginFromForgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordView?.classList.add('hidden');
        document.getElementById('loginView')?.classList.remove('hidden');
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailEl = document.getElementById('forgotEmail');
        const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');

        if (!emailEl || !submitBtn) return;
        const email = emailEl.value.trim();

        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = "⏳ Dispatching Recovery Link...";

        try {
            await auth.sendPasswordResetEmail(email);
            if (typeof showToast === 'function') {
                showToast("📬 Password recovery email sent! Check your inbox.");
            }
            forgotPasswordForm.reset();
            forgotPasswordView.classList.add('hidden');
            document.getElementById('loginView')?.classList.remove('hidden');
        } catch (err) {
            console.error('Password Reset Error:', err);
            if (typeof showToast === 'function') {
                showToast("❌ Error: " + err.message, false);
            }
            emailEl.value = '';
            emailEl.focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// Auth State Monitor
if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
        const authModal = document.getElementById('authModal');
        const dashboardView = document.getElementById('dashboardView');
        const projectWorkspace = document.getElementById('projectWorkspace');
        
        if (user && user.emailVerified) {
            if (typeof syncProfileAndHideModal === 'function') {
                syncProfileAndHideModal(user);
            }
        } else {
            if (dashboardView) dashboardView.classList.add('hidden');
            if (projectWorkspace) projectWorkspace.classList.add('hidden');
            if (authModal) authModal.classList.remove('hidden');
            
            const loginView = document.getElementById('loginView');
            const signupView = document.getElementById('signupView');
            const verifyView = document.getElementById('verifyView');
            const forgotPassView = document.getElementById('forgotPasswordView');

            loginView?.classList.remove('hidden');
            signupView?.classList.add('hidden');
            verifyView?.classList.add('hidden');
            forgotPassView?.classList.add('hidden');
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const loader = document.getElementById("appLoader");

    // Load local projects on boot
    if (typeof loadProjects === "function") loadProjects();
    if (typeof renderDashboard === "function") renderDashboard();

    // Smoothly dismiss the wolf loader after full initialization
    if (loader) {
        setTimeout(() => {
            loader.classList.add("fade-out");
            setTimeout(() => loader.remove(), 650);
        }, 750); 
    }
    console.log("🐺 Wolf Workspace is ready.");
});
