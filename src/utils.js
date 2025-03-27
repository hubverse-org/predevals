function titleCase(str) {  // per https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

function toLowerCaseIfString(input) {
    if (typeof input === 'string') {
        return input.toLowerCase();
    } else {
        return input;
    }
}

function hexToRGB(hex) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

function get_round_decimals(col_name) {
    const relative_skill_regex = new RegExp('_scaled_relative_skill$');
    if (relative_skill_regex.test(col_name)) {
        return 2;
    } else {
        return 1;
    }
}

export {titleCase, toLowerCaseIfString, hexToRGB, get_round_decimals}
