import os
import re
import logging
import random
import string
import math
import json
import time
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
import zxcvbn

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key")

# Word lists for different password generation methods
COMMON_WORDS = ["apple", "orange", "banana", "grape", "melon", "cherry", "lemon",
             "kiwi", "peach", "plum", "mango", "berry", "pear", "lime", "fig"]

ADJECTIVES = ["happy", "brave", "calm", "wise", "kind", "quick", "bold", "bright", 
           "clever", "fierce", "gentle", "grand", "lively", "noble", "proud"]

NOUNS = ["tiger", "river", "mountain", "ocean", "forest", "eagle", "castle", 
         "garden", "island", "journey", "legend", "meteor", "planet", "shadow", "thunder"]

VERBS = ["runs", "jumps", "flies", "builds", "creates", "dreams", "explores", 
         "fights", "grows", "holds", "leads", "moves", "seeks", "shines", "wins"]

# Enhanced password generation
def generate_password(length=16, use_uppercase=True, use_lowercase=True, 
                      use_digits=True, use_symbols=True, method="random", 
                      pattern=None, exclude_similar=False, exclude_ambiguous=False):
    """
    Generates a password based on user preferences.
    Returns the generated password.
    """
    # Define character sets
    uppercase_chars = string.ascii_uppercase
    lowercase_chars = string.ascii_lowercase
    digit_chars = string.digits
    symbol_chars = "!@#$%^&*()_-+=<>?"
    
    # Apply exclusions
    if exclude_similar:
        # Remove similar characters like l/1/I, 0/O, etc.
        chars_to_remove = "il1Lo0O"
        uppercase_chars = ''.join(c for c in uppercase_chars if c not in chars_to_remove)
        lowercase_chars = ''.join(c for c in lowercase_chars if c not in chars_to_remove)
        digit_chars = ''.join(c for c in digit_chars if c not in chars_to_remove)
    
    if exclude_ambiguous:
        # Remove potentially confusing symbols
        ambiguous_symbols = "{}[]()/'\"\\`~,;:.<>"
        symbol_chars = ''.join(c for c in symbol_chars if c not in ambiguous_symbols)
    
    # Create the character pool based on user preferences
    chars = ""
    if use_uppercase:
        chars += uppercase_chars
    if use_lowercase:
        chars += lowercase_chars
    if use_digits:
        chars += digit_chars
    if use_symbols:
        chars += symbol_chars
    
    # Fallback to lowercase if no options are selected
    if not chars:
        chars = lowercase_chars
    
    # Generate password based on method
    if method == "random":
        # Simple random password generation
        password = ''.join(random.choice(chars) for _ in range(length))
        
        # Ensure password contains at least one character from each selected set
        if length >= 4:
            required_chars = []
            if use_uppercase:
                required_chars.append(random.choice(uppercase_chars))
            if use_lowercase:
                required_chars.append(random.choice(lowercase_chars))
            if use_digits:
                required_chars.append(random.choice(digit_chars))
            if use_symbols:
                required_chars.append(random.choice(symbol_chars))
            
            # Replace first few characters with required characters
            for i, c in enumerate(required_chars):
                if i < length:
                    position = random.randint(0, length - 1)
                    password = password[:position] + c + password[position+1:]
    
    elif method == "memorable":
        # Memorable password with words
        num_words = max(2, length // 6)
        selected_words = random.sample(COMMON_WORDS, min(num_words, len(COMMON_WORDS)))
        
        # Capitalize first letter of each word if uppercase is enabled
        if use_uppercase:
            selected_words = [word.capitalize() for word in selected_words]
        
        # Add digits if enabled
        if use_digits:
            selected_words.append(str(random.randint(10, 999)))
        
        # Add symbols if enabled
        if use_symbols:
            selected_words.append(random.choice(symbol_chars) + random.choice(symbol_chars))
        
        # Join words and truncate/pad to desired length
        password = "".join(selected_words)
        if len(password) > length:
            password = password[:length]
        elif len(password) < length:
            # Pad with random characters
            password += ''.join(random.choice(chars) for _ in range(length - len(password)))
    
    elif method == "pattern":
        # Pattern-based password generation
        if not pattern:
            pattern = "AvAnDvD"  # Default pattern: Adjective-verb-Adjective-noun-Digit-verb-Digit
        
        password = ""
        for char in pattern:
            if char == 'A':
                word = random.choice(ADJECTIVES)
                password += word.capitalize() if use_uppercase else word
            elif char == 'N':
                word = random.choice(NOUNS)
                password += word.capitalize() if use_uppercase else word
            elif char == 'V':
                word = random.choice(VERBS)
                password += word.capitalize() if use_uppercase else word
            elif char == 'C':
                password += random.choice(uppercase_chars if use_uppercase else lowercase_chars)
            elif char == 'c':
                password += random.choice(lowercase_chars)
            elif char == 'D':
                if use_digits:
                    password += random.choice(digit_chars)
                else:
                    password += random.choice(lowercase_chars)
            elif char == 'S':
                if use_symbols:
                    password += random.choice(symbol_chars)
                else:
                    password += random.choice(lowercase_chars)
            else:
                password += char
        
        # Truncate to length if needed
        if len(password) > length:
            password = password[:length]
        elif len(password) < length:
            # Pad with random characters
            password += ''.join(random.choice(chars) for _ in range(length - len(password)))
    
    elif method == "xkcd":
        # XKCD style - four random words separated by a symbol
        separator = random.choice(symbol_chars) if use_symbols else "-"
        words = random.sample(COMMON_WORDS + ADJECTIVES + NOUNS, 4)
        
        # Capitalize if requested
        if use_uppercase:
            words = [word.capitalize() for word in words]
            
        # Add a number if requested
        if use_digits:
            words[-1] = words[-1] + str(random.randint(10, 99))
            
        password = separator.join(words)
        
        # Truncate if needed
        if len(password) > length:
            password = password[:length]
    
    elif method == "pin":
        # PIN style - all digits
        if use_digits:
            password = ''.join(random.choice(digit_chars) for _ in range(length))
        else:
            # Fallback to lowercase if digits aren't allowed
            password = ''.join(random.choice(lowercase_chars) for _ in range(length))
    
    return password

def estimate_crack_time(password):
    """
    Estimates the time it would take to crack a password.
    Returns a human-readable time string and score (0-4).
    """
    # Use zxcvbn for password strength analysis
    result = zxcvbn.zxcvbn(password)
    
    # Get crack time in human-readable format
    crack_time = result['crack_times_display']['offline_slow_hashing_1e4_per_second']
    
    # Get score (0-4, where 0 is very weak and 4 is very strong)
    score = result['score']
    
    return {
        'crack_time': crack_time,
        'score': score,
        'feedback': result.get('feedback', {}),
        'entropy': result['guesses_log10'],
        'raw_result': result
    }

def analyze_password_patterns(password):
    """Analyze patterns in the password for additional insights"""
    analysis = {
        'length': len(password),
        'character_sets': {
            'uppercase': 0,
            'lowercase': 0,
            'digits': 0,
            'symbols': 0
        },
        'repeating_chars': 0,
        'sequential_chars': 0,
        'keyboard_patterns': 0
    }
    
    # Count character types
    for char in password:
        if char in string.ascii_uppercase:
            analysis['character_sets']['uppercase'] += 1
        elif char in string.ascii_lowercase:
            analysis['character_sets']['lowercase'] += 1
        elif char in string.digits:
            analysis['character_sets']['digits'] += 1
        else:
            analysis['character_sets']['symbols'] += 1
    
    # Check for repeating characters (e.g., "aaa")
    repeats = re.findall(r'(.)\1{2,}', password)
    analysis['repeating_chars'] = len(repeats)
    
    # Check for sequential characters (e.g., "abc", "123")
    sequences = [
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        '0123456789'
    ]
    
    for seq in sequences:
        for i in range(len(seq) - 2):
            if seq[i:i+3] in password:
                analysis['sequential_chars'] += 1
    
    # Check for common keyboard patterns (simplified)
    keyboard_patterns = [
        'qwerty', 'asdfgh', 'zxcvbn', '123456', 'qazwsx'
    ]
    
    for pattern in keyboard_patterns:
        if pattern in password.lower():
            analysis['keyboard_patterns'] += 1
    
    return analysis

def get_password_suggestions(password_analysis, strength_info):
    """Generate suggestions based on password analysis"""
    suggestions = []
    
    # Use feedback from zxcvbn if available
    if strength_info.get('feedback', {}).get('suggestions'):
        suggestions.extend(strength_info.get('feedback', {}).get('suggestions', []))
    
    # Add our custom suggestions
    if password_analysis['length'] < 12:
        suggestions.append("Consider using a longer password (at least 12 characters)")
    
    if password_analysis['character_sets']['uppercase'] == 0:
        suggestions.append("Add uppercase letters to increase complexity")
    
    if password_analysis['character_sets']['lowercase'] == 0:
        suggestions.append("Add lowercase letters to increase complexity")
    
    if password_analysis['character_sets']['digits'] == 0:
        suggestions.append("Add digits to increase complexity")
    
    if password_analysis['character_sets']['symbols'] == 0:
        suggestions.append("Add symbols to increase complexity")
    
    if password_analysis['repeating_chars'] > 0:
        suggestions.append("Avoid repeating characters (like 'aaa')")
    
    if password_analysis['sequential_chars'] > 0:
        suggestions.append("Avoid sequential characters (like '123' or 'abc')")
    
    if password_analysis['keyboard_patterns'] > 0:
        suggestions.append("Avoid keyboard patterns (like 'qwerty')")
    
    # Remove duplicates and return
    return list(set(suggestions))

def add_to_history(password, strength_score, crack_time):
    """Add a password to the session history"""
    if 'password_history' not in session:
        session['password_history'] = []
    
    # Add password with timestamp and truncate to latest 10
    history_item = {
        'password': password,
        'score': strength_score,
        'crack_time': crack_time,
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    # Add to front of list
    session['password_history'].insert(0, history_item)
    
    # Limit to 10 items
    session['password_history'] = session['password_history'][:10]
    session.modified = True

@app.route('/')
def index():
    """Renders the main page."""
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    """Generates a password based on user preferences."""
    data = request.get_json() or {}
    
    # Get parameters with defaults
    length = max(6, min(128, int(data.get('length', 16))))
    use_uppercase = data.get('uppercase', True)
    use_lowercase = data.get('lowercase', True)
    use_digits = data.get('digits', True)
    use_symbols = data.get('symbols', True)
    method = data.get('method', 'random')
    pattern = data.get('pattern', None)
    exclude_similar = data.get('exclude_similar', False)
    exclude_ambiguous = data.get('exclude_ambiguous', False)
    
    # Generate password
    password = generate_password(
        length=length,
        use_uppercase=use_uppercase,
        use_lowercase=use_lowercase,
        use_digits=use_digits,
        use_symbols=use_symbols,
        method=method,
        pattern=pattern,
        exclude_similar=exclude_similar,
        exclude_ambiguous=exclude_ambiguous
    )
    
    # Estimate crack time
    strength_info = estimate_crack_time(password)
    
    # Perform extended analysis
    analysis = analyze_password_patterns(password)
    
    # Get custom suggestions
    suggestions = get_password_suggestions(analysis, strength_info)
    
    # Add to password history
    add_to_history(password, strength_info['score'], strength_info['crack_time'])
    
    # Return response
    return jsonify({
        'password': password,
        'crack_time': strength_info['crack_time'],
        'score': strength_info['score'],
        'feedback': suggestions,
        'entropy': strength_info['entropy'],
        'analysis': analysis
    })

@app.route('/check', methods=['POST'])
def check_password():
    """Evaluates the submitted password and returns strength results."""
    data = request.get_json()
    password = data.get('password', '')
    
    if not password:
        return jsonify({"error": "No password provided"}), 400
    
    try:
        # Estimate crack time using zxcvbn
        strength_info = estimate_crack_time(password)
        
        # Perform extended analysis
        analysis = analyze_password_patterns(password)
        
        # Get custom suggestions
        suggestions = get_password_suggestions(analysis, strength_info)
        
        # Get common password check
        common_password = False
        if strength_info['raw_result'].get('guesses', 0) < 1000:
            common_password = True
            if "This is a commonly used password" not in suggestions:
                suggestions.append("This is a commonly used password or pattern")
        
        # Get score (0-4, where 0 is very weak and 4 is very strong)
        score = strength_info['score']
        
        # Convert score to percentage for progress bar
        score_percent = (score / 4) * 100
        
        # Return the results
        return jsonify({
            'crack_time': strength_info['crack_time'],
            'score': score,
            'score_percent': score_percent,
            'feedback': suggestions,
            'entropy': strength_info['entropy'],
            'analysis': analysis,
            'common_password': common_password,
            'strength': ["Very Weak", "Weak", "Fair", "Good", "Strong"][score]
        })
    except Exception as e:
        logging.error(f"Error checking password: {str(e)}")
        return jsonify({"error": f"Error checking password: {str(e)}"}), 500

@app.route('/history', methods=['GET'])
def get_history():
    """Return password generation history"""
    try:
        history = session.get('password_history', [])
        return jsonify({'history': history})
    except Exception as e:
        logging.error(f"Error getting history: {str(e)}")
        return jsonify({"error": f"Error getting history: {str(e)}"}), 500

@app.route('/history/clear', methods=['POST'])
def clear_history():
    """Clear password generation history"""
    try:
        session['password_history'] = []
        session.modified = True
        return jsonify({'success': True})
    except Exception as e:
        logging.error(f"Error clearing history: {str(e)}")
        return jsonify({"error": f"Error clearing history: {str(e)}"}), 500

@app.route('/analyze', methods=['POST'])
def deep_analyze():
    """Perform deep password analysis"""
    data = request.get_json()
    password = data.get('password', '')
    
    if not password:
        return jsonify({"error": "No password provided"}), 400
    
    try:
        # Get comprehensive analysis
        strength_info = estimate_crack_time(password)
        analysis = analyze_password_patterns(password)
        
        # Create a more detailed response
        character_distribution = {}
        for char in password:
            if char in character_distribution:
                character_distribution[char] += 1
            else:
                character_distribution[char] = 1
        
        # Check if it's a variation of the username
        username = data.get('username', '')
        username_similarity = 0
        if username:
            # Simple check for username being contained in password
            if username.lower() in password.lower():
                username_similarity = 100
            else:
                # Calculate similarity percentage (very simple algorithm)
                common_chars = set(username.lower()) & set(password.lower())
                if len(username) > 0:
                    username_similarity = int((len(common_chars) / len(username)) * 100)
        
        return jsonify({
            'basic_analysis': analysis,
            'strength': strength_info,
            'character_distribution': character_distribution,
            'username_similarity': username_similarity,
            'patterns_detected': {
                'sequential': analysis['sequential_chars'] > 0,
                'repeated': analysis['repeating_chars'] > 0,
                'keyboard_pattern': analysis['keyboard_patterns'] > 0,
                'common_password': strength_info['raw_result'].get('guesses', 0) < 1000
            }
        })
    except Exception as e:
        logging.error(f"Error analyzing password: {str(e)}")
        return jsonify({"error": f"Error analyzing password: {str(e)}"}), 500

@app.route('/export', methods=['POST'])
def export_passwords():
    """Export password list in different formats"""
    try:
        data = request.get_json()
        format_type = data.get('format', 'text')
        passwords = data.get('passwords', [])
        
        if not passwords:
            # If no passwords are explicitly provided, use the history
            history = session.get('password_history', [])
            passwords = [item.get('password', '') for item in history if item.get('password')]
        
        if format_type == 'text':
            # Simple text format
            content = "\n".join(passwords)
            return jsonify({'content': content, 'format': 'text'})
        
        elif format_type == 'csv':
            # CSV format
            csv_content = "Password,Strength,Generated\n"
            for pwd in passwords:
                csv_content += f"{pwd},N/A,{datetime.now().strftime('%Y-%m-%d')}\n"
            return jsonify({'content': csv_content, 'format': 'csv'})
        
        elif format_type == 'json':
            # JSON format
            json_content = []
            for pwd in passwords:
                json_content.append({
                    'password': pwd,
                    'generated': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
            return jsonify({'content': json_content, 'format': 'json'})
        
        else:
            return jsonify({'error': 'Unsupported format'}), 400
    except Exception as e:
        logging.error(f"Error exporting passwords: {str(e)}")
        return jsonify({"error": f"Error exporting passwords: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)