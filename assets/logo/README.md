# Monarch Database Logo Assets

## Logo Files

### Primary Logo
- `monarch-logo.svg` - Vector logo (preferred for web)
- `monarch-logo.png` - PNG logo (300x100px, transparent)
- `monarch-logo-dark.png` - Dark background variant

### Icon
- `monarch-icon.svg` - Square icon (64x64px)
- `monarch-icon.png` - PNG icon (64x64px, transparent)

### Favicon
- `favicon.ico` - ICO format (16x16, 32x32, 48x48)
- `favicon.svg` - SVG favicon

## Brand Colors

### Primary Colors
- **Crown Gold**: `#FFD700` (primary accent)
- **Royal Purple**: `#6B46C1` (primary brand)
- **Deep Blue**: `#1E3A8A` (secondary)
- **Silver**: `#E5E7EB` (neutral)

### Text Colors
- **Primary Text**: `#111827` (dark mode: `#F9FAFB`)
- **Secondary Text**: `#6B7280` (dark mode: `#9CA3AF`)

## Usage Guidelines

### Logo Usage
- Minimum size: 100px width
- Clear space: 1x logo height around logo
- Do not modify colors or proportions
- Do not place on busy backgrounds

### Color Usage
- Use brand colors consistently
- Maintain contrast ratios for accessibility
- Test color combinations in both light and dark modes

## Typography

### Primary Font: Inter
- **Weights**: Regular (400), Medium (500), Semi-bold (600), Bold (700)
- **Usage**: Body text, UI elements, documentation

### Secondary Font: JetBrains Mono
- **Weights**: Regular (400), Medium (500)
- **Usage**: Code blocks, terminal output, API documentation

## Asset Generation

To regenerate assets from source files:

```bash
# Install dependencies
npm install --save-dev sharp svg2png-many

# Generate PNGs from SVG
npx svg2png-many assets/logo/monarch-logo.svg --sizes 300x100

# Optimize images
npx sharp resize assets/logo/*.png --withoutEnlargement --webp --avif
```

## Contributing

When adding new brand assets:
1. Follow the established naming convention
2. Include multiple formats (SVG preferred, PNG fallback)
3. Test across different backgrounds
4. Update this README with new assets
