/**
 * Test Utilities for Learning Games
 * Lightweight test framework for browser-based testing
 */

export class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentSuite = 'Default';
    }

    /**
     * Start a new test suite
     */
    suite(name) {
        this.currentSuite = name;
        console.log(`\n📦 Test Suite: ${name}`);
        console.log('─'.repeat(40));
    }

    /**
     * Run a single test
     */
    async run(name, testFn) {
        const fullName = `${this.currentSuite} > ${name}`;
        try {
            await testFn();
            this.passed++;
            this.results.push({ name: fullName, status: 'pass' });
            console.log(`  ✅ ${name}`);
        } catch (error) {
            this.failed++;
            this.results.push({ name: fullName, status: 'fail', error: error.message });
            console.error(`  ❌ ${name}`);
            console.error(`     └─ ${error.message}`);
        }
    }

    /**
     * Assert two values are equal
     */
    assertEqual(actual, expected, message = '') {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(`${message} Expected: ${expectedStr}, Got: ${actualStr}`);
        }
    }

    /**
     * Assert value is true
     */
    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`${message || 'Expected true, got false'}`);
        }
    }

    /**
     * Assert value is false
     */
    assertFalse(condition, message = '') {
        if (condition) {
            throw new Error(`${message || 'Expected false, got true'}`);
        }
    }

    /**
     * Assert value is not null/undefined
     */
    assertNotNull(value, message = '') {
        if (value === null || value === undefined) {
            throw new Error(`${message || 'Expected non-null value, got null/undefined'}`);
        }
    }

    /**
     * Assert value is null/undefined
     */
    assertNull(value, message = '') {
        if (value !== null && value !== undefined) {
            throw new Error(`${message || `Expected null/undefined, got ${value}`}`);
        }
    }

    /**
     * Assert array has expected length
     */
    assertLength(array, expectedLength, message = '') {
        if (!Array.isArray(array)) {
            throw new Error(`${message || 'Expected array'}`);
        }
        if (array.length !== expectedLength) {
            throw new Error(`${message} Expected length: ${expectedLength}, Got: ${array.length}`);
        }
    }

    /**
     * Assert array is not empty
     */
    assertNotEmpty(array, message = '') {
        if (!Array.isArray(array) || array.length === 0) {
            throw new Error(`${message || 'Expected non-empty array'}`);
        }
    }

    /**
     * Assert object has property
     */
    assertHasProperty(obj, property, message = '') {
        if (!(property in obj)) {
            throw new Error(`${message || `Expected object to have property: ${property}`}`);
        }
    }

    /**
     * Assert function throws an error
     */
    async assertThrows(fn, message = '') {
        try {
            await fn();
            throw new Error(`${message || 'Expected function to throw'}`);
        } catch (error) {
            if (error.message === (message || 'Expected function to throw')) {
                throw error;
            }
            // Expected error was thrown, test passes
        }
    }

    /**
     * Print test summary
     */
    summary() {
        console.log('\n' + '═'.repeat(40));
        console.log('📊 TEST SUMMARY');
        console.log('═'.repeat(40));
        console.log(`Total:  ${this.passed + this.failed}`);
        console.log(`Passed: ${this.passed} ✅`);
        console.log(`Failed: ${this.failed} ❌`);
        console.log('═'.repeat(40));

        if (this.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️ Some tests failed:');
            this.results
                .filter(r => r.status === 'fail')
                .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
        }

        return {
            passed: this.passed,
            failed: this.failed,
            total: this.passed + this.failed,
            results: this.results
        };
    }

    /**
     * Reset test state
     */
    reset() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.currentSuite = 'Default';
    }
}

/**
 * Mock fetch for testing
 */
export class MockFetch {
    static originalFetch = null;
    static responses = new Map();

    /**
     * Start mocking fetch
     */
    static start() {
        if (!this.originalFetch) {
            this.originalFetch = window.fetch;
        }
        window.fetch = async (url) => {
            const response = this.responses.get(url);
            if (response) {
                if (response.error) {
                    throw new Error(response.error);
                }
                return {
                    ok: response.ok !== false,
                    status: response.status || 200,
                    json: async () => response.data
                };
            }
            // Default: return 404
            return { ok: false, status: 404 };
        };
    }

    /**
     * Set mock response for a URL
     */
    static setResponse(url, data, ok = true) {
        this.responses.set(url, { data, ok });
    }

    /**
     * Set mock error for a URL
     */
    static setError(url, errorMessage) {
        this.responses.set(url, { error: errorMessage });
    }

    /**
     * Clear all mock responses
     */
    static clear() {
        this.responses.clear();
    }

    /**
     * Restore original fetch
     */
    static restore() {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
            this.originalFetch = null;
        }
        this.clear();
    }
}

/**
 * Wait for a specified time
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test iframe for loading game pages
 */
export function createTestFrame(src) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width: 100%; height: 400px; border: 1px solid #ccc;';
        iframe.src = src;
        iframe.onload = () => resolve(iframe);
        iframe.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.body.appendChild(iframe);
    });
}

/**
 * Remove test iframe
 */
export function removeTestFrame(iframe) {
    if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
    }
}

// Create global instance for convenience
export const testRunner = new TestRunner();
