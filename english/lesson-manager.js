// lesson-manager.js - Shared lesson management functionality
// כלול קובץ זה בכל משחק כדי לתמוך בשיעורים

const LessonManager = {
    allVocabulary: [],
    currentLessonId: 'all',

    // Initialize and load vocabulary
    async init(vocabulary) {
        if (vocabulary && vocabulary.length > 0) {
            this.allVocabulary = vocabulary;
            console.log('✅ Vocabulary initialized with', vocabulary.length, 'words');
        } else {
            this.allVocabulary = [];
            console.log('⚠️ No vocabulary provided');
        }
    },
    
    // Get all lessons (extract unique lessons from vocabulary)
    getLessons() {
        const lessonIds = [...new Set(this.allVocabulary.map(word => word.lesson))];
        return lessonIds.sort().map(id => ({
            id: id,
            name: `Unit ${id}`
        }));
    },

    // Get vocabulary for specific lesson
    getVocabularyForLesson(lessonId) {
        if (lessonId === 'all') {
            return this.allVocabulary;
        }
        return this.allVocabulary.filter(word => word.lesson === lessonId);
    },
    
    // Set current lesson
    setLesson(lessonId) {
        this.currentLessonId = lessonId;
    },
    
    // Get current vocabulary
    getCurrentVocabulary() {
        return this.getVocabularyForLesson(this.currentLessonId);
    },

    // Get current lesson ID
    getCurrentLesson() {
        return this.currentLessonId;
    },
    
    // Create lesson selector HTML
    createLessonSelector(containerId, onChange, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const lessons = this.getLessons();
        const { includeShuffleButton = false, onShuffle = null } = options;

        const html = `
            <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 10px; backdrop-filter: blur(10px);">
                <label for="lessonSelect" style="color: white; font-weight: bold; font-size: 1.1em;">📚 שיעור:</label>
                <select id="lessonSelect" style="padding: 8px 15px; border-radius: 8px; border: none; font-size: 1.1em; font-weight: bold; cursor: pointer; background: white; color: #667eea;">
                    <option value="all">כל השיעורים</option>
                    ${lessons.map(lesson => `<option value="${lesson.id}" ${lesson.id === this.currentLessonId ? 'selected' : ''}>${lesson.name}</option>`).join('')}
                </select>
                <span id="lessonWordCount" style="color: white; font-size: 0.9em;"></span>
                ${includeShuffleButton ? '<button id="shuffleBtn" style="background: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.5); color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1em; transition: all 0.2s;">🔀 ערבב</button>' : ''}
            </div>
        `;

        container.innerHTML = html;
        
        // Update word count
        this.updateWordCount();

        // Add event listener for lesson select
        const select = document.getElementById('lessonSelect');
        select.addEventListener('change', (e) => {
            const value = e.target.value;
            this.currentLessonId = value === 'all' ? 'all' : parseInt(value);
            this.updateWordCount();
            if (onChange) onChange(this.currentLessonId);
        });

        // Add event listener for shuffle button if included
        if (includeShuffleButton && onShuffle) {
            const shuffleBtn = document.getElementById('shuffleBtn');
            if (shuffleBtn) {
                shuffleBtn.addEventListener('click', onShuffle);
                shuffleBtn.addEventListener('mouseenter', (e) => {
                    e.target.style.background = 'rgba(255,255,255,0.4)';
                });
                shuffleBtn.addEventListener('mouseleave', (e) => {
                    e.target.style.background = 'rgba(255,255,255,0.3)';
                });
            }
        }
    },
    
    // Update word count display
    updateWordCount() {
        const countElement = document.getElementById('lessonWordCount');
        if (countElement) {
            const count = this.getCurrentVocabulary().length;
            countElement.textContent = `(${count} מילים)`;
        }
    }
};
