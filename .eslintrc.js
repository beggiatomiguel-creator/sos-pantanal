module.exports = {
  env: {
    browser: true,
    es2021: true,
    worker: true
  },
  extends: [
    '@eslint/js/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Code quality
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    'no-console': ['warn', { 
      allow: ['warn', 'error', 'info'] 
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // ES6+
    'arrow-spacing': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': ['error', {
      array: false,
      object: true
    }],
    
    // Style
    'indent': ['error', 2, { 
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1
    }],
    'quotes': ['error', 'single', { 
      avoidEscape: true,
      allowTemplateLiterals: true 
    }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'eol-last': 'error',
    'no-trailing-spaces': 'error',
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'dot-notation': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-void': 'error',
    'radix': 'error',
    'wrap-iife': ['error', 'inside'],
    'yoda': 'error',
    
    // Security
    'no-new-wrappers': 'error',
    'no-script-url': 'error',
    
    // Performance
    'no-loop-func': 'error',
    
    // Async/Await
    'require-await': 'error',
    'no-return-await': 'error',
    
    // Import/Export
    'import/order': 'off', // Not using ES modules imports in all files yet
    
    // Warnings for future improvements
    'max-len': ['warn', { 
      code: 120,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true
    }],
    'max-depth': ['warn', 4],
    'max-params': ['warn', 5],
    'complexity': ['warn', 15]
  },
  overrides: [
    {
      files: ['sw.js'],
      env: {
        serviceworker: true
      },
      rules: {
        'no-console': 'off' // Service workers need console logging
      }
    },
    {
      files: ['*.test.js', '**/__tests__/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ],
  globals: {
    // Leaflet
    'L': 'readonly',
    
    // Lucide
    'lucide': 'readonly',
    
    // Service Worker
    'self': 'readonly',
    'caches': 'readonly',
    'skipWaiting': 'readonly',
    'clients': 'readonly'
  }
};
