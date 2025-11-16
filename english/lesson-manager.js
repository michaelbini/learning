// lesson-manager.js - Shared lesson management functionality
// כלול קובץ זה בכל משחק כדי לתמוך בשיעורים

const LessonManager = {
    lessons: [],
    allVocabulary: [],
    currentLessonId: 'all',
    
    // Initialize and load vocabulary
    async init(embeddedVocabulary) {
        try {
            const response = await fetch('vocabulary.json');
            if (response.ok) {
                const data = await response.json();
                
                // Check if new structure (with lessons array)
                if (data.lessons && Array.isArray(data.lessons)) {
                    this.lessons = data.lessons;
                    // Flatten all words from all lessons
                    this.allVocabulary = data.lessons.flatMap(lesson => lesson.words);
                    console.log('✅ Vocabulary loaded from external JSON file (lessons structure)');
                } else {
                    // Old structure - array of words
                    // Convert to new structure
                    this.lessons = [{
                        id: 1,
                        name: "Unit 1",
                        words: data
                    }];
                    this.allVocabulary = data;
                    console.log('✅ Vocabulary loaded from external JSON file (legacy structure)');
                }
            } else {
                console.log('ℹ️ No external JSON found, using embedded vocabulary');
                this.lessons = [{
                    id: 1,
                    name: "Unit 1",
                    words: embeddedVocabulary
                }];
                this.allVocabulary = embeddedVocabulary;
            }
        } catch (error) {
            console.log('ℹ️ Using embedded vocabulary');
            this.lessons = [{
                id: 1,
                name: "Unit 1",
                words: embeddedVocabulary
            }];
            this.allVocabulary = embeddedVocabulary;
        }
    },
    
    // Get all lessons
    getLessons() {
        return this.lessons;
    },
    
    // Get vocabulary for specific lesson
    getVocabularyForLesson(lessonId) {
        if (lessonId === 'all') {
            return this.allVocabulary;
        }
        const lesson = this.lessons.find(l => l.id === lessonId);
        return lesson ? lesson.words : [];
    },
    
    // Set current lesson
    setLesson(lessonId) {
        this.currentLessonId = lessonId;
    },
    
    // Get current vocabulary
    getCurrentVocabulary() {
        return this.getVocabularyForLesson(this.currentLessonId);
    },
    
    // Create lesson selector HTML
    createLessonSelector(containerId, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const lessons = this.getLessons();
        
        const html = `
            <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 10px; backdrop-filter: blur(10px);">
                <label for="lessonSelect" style="color: white; font-weight: bold; font-size: 1.1em;">📚 שיעור:</label>
                <select id="lessonSelect" style="padding: 8px 15px; border-radius: 8px; border: none; font-size: 1.1em; font-weight: bold; cursor: pointer; background: white; color: #667eea;">
                    <option value="all">כל השיעורים</option>
                    ${lessons.map(lesson => `<option value="${lesson.id}" ${lesson.id === this.currentLessonId ? 'selected' : ''}>${lesson.name}</option>`).join('')}
                </select>
                <span id="lessonWordCount" style="color: white; font-size: 0.9em;"></span>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Update word count
        this.updateWordCount();
        
        // Add event listener
        const select = document.getElementById('lessonSelect');
        select.addEventListener('change', (e) => {
            const value = e.target.value;
            this.currentLessonId = value === 'all' ? 'all' : parseInt(value);
            this.updateWordCount();
            if (onChange) onChange(this.currentLessonId);
        });
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
