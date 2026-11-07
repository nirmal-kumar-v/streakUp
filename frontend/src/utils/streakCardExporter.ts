import { StreakMilestone } from './streakMilestones';

export interface StreakCardExportParams {
  milestone: StreakMilestone;
  currentStreak: number;
  userName?: string;
  userHandle?: string;
}

/**
 * Renders an ultra-high resolution (1080x1080) celebratory card image
 * strictly matching the CodeChef / StreakUp premium aesthetic (Sample Image 1 & 2).
 */
export async function renderStreakCardCanvas(params: StreakCardExportParams): Promise<HTMLCanvasElement> {
  const { milestone, userName } = params;
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. Background: Deep obsidian gradient
  const bgGrad = ctx.createRadialGradient(size / 2, size * 0.45, 100, size / 2, size * 0.5, size * 0.75);
  bgGrad.addColorStop(0, '#261C08'); // Warm golden amber center glow
  bgGrad.addColorStop(0.5, '#120E04');
  bgGrad.addColorStop(1, '#08080B'); // Deep space charcoal outer
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle starry particles in background
  ctx.fillStyle = 'rgba(255, 235, 150, 0.4)';
  const starCoords = [
    [180, 160, 3], [860, 210, 2.5], [240, 780, 2], [820, 820, 3],
    [150, 480, 2], [930, 460, 2.5], [320, 260, 1.5], [760, 320, 2],
    [290, 890, 2.5], [790, 680, 1.8], [420, 180, 2], [660, 190, 2],
  ];
  for (const [x, y, r] of starCoords) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Holographic Upward Light Beam from pedestal (matching Sample Image 1)
  const beamGrad = ctx.createLinearGradient(size / 2, 700, size / 2, 340);
  beamGrad.addColorStop(0, 'rgba(255, 200, 50, 0.28)');
  beamGrad.addColorStop(0.6, 'rgba(255, 180, 30, 0.12)');
  beamGrad.addColorStop(1, 'rgba(255, 160, 0, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(380, 700);
  ctx.lineTo(460, 340);
  ctx.lineTo(620, 340);
  ctx.lineTo(700, 700);
  ctx.closePath();
  ctx.fill();

  // Pedestal glowing base rings
  ctx.save();
  ctx.translate(size / 2, 700);
  ctx.scale(1, 0.32); // Flatten into 3D ground ellipse
  const pedGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 220);
  pedGrad.addColorStop(0, 'rgba(255, 235, 150, 0.95)');
  pedGrad.addColorStop(0.3, 'rgba(255, 180, 20, 0.6)');
  pedGrad.addColorStop(0.7, 'rgba(255, 140, 0, 0.2)');
  pedGrad.addColorStop(1, 'rgba(255, 120, 0, 0)');
  ctx.fillStyle = pedGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 220, 0, Math.PI * 2);
  ctx.fill();

  // Crisp inner ring on pedestal
  ctx.strokeStyle = 'rgba(255, 235, 180, 0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 160, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Top Header Text (matching Sample Image 1)
  ctx.textAlign = 'center';

  // Sub-header: "Congratulations! For maintaining"
  ctx.font = '500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#E5E7EB';
  ctx.fillText('Congratulations! For maintaining', size / 2, 175);

  // Main bold highlight headline: "50 Days coding streak" (or "50 Days Habit Streak")
  ctx.font = '900 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const headlineGrad = ctx.createLinearGradient(size / 2 - 250, 240, size / 2 + 250, 240);
  headlineGrad.addColorStop(0, '#FFE57F');
  headlineGrad.addColorStop(0.5, '#FFD54F');
  headlineGrad.addColorStop(1, '#FFA000');
  ctx.fillStyle = headlineGrad;
  ctx.shadowColor = 'rgba(255, 180, 0, 0.5)';
  ctx.shadowBlur = 24;
  ctx.fillText(milestone.tagline, size / 2, 245);
  ctx.shadowBlur = 0; // reset

  // 4. Center 3D Floating Medallion (Drawn using high-res vector primitives)
  const medalCenterX = size / 2;
  const medalCenterY = 500;
  const medalRadius = 150;

  // Medallion ambient shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 15;

  // Outer gold rim
  const rimGrad = ctx.createLinearGradient(medalCenterX - medalRadius, medalCenterY - medalRadius, medalCenterX + medalRadius, medalCenterY + medalRadius);
  rimGrad.addColorStop(0, '#FFF59D');
  rimGrad.addColorStop(0.3, '#FFD54F');
  rimGrad.addColorStop(0.7, '#C79100');
  rimGrad.addColorStop(1, '#FFE082');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(medalCenterX, medalCenterY, medalRadius, 0, Math.PI * 2);
  ctx.fill();

  // Stepped dark channel
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#422400';
  ctx.beginPath();
  ctx.arc(medalCenterX, medalCenterY, medalRadius - 10, 0, Math.PI * 2);
  ctx.fill();

  // Inner beveled gold ridge
  const innerRidgeGrad = ctx.createLinearGradient(medalCenterX + medalRadius, medalCenterY - medalRadius, medalCenterX - medalRadius, medalCenterY + medalRadius);
  innerRidgeGrad.addColorStop(0, '#FFE082');
  innerRidgeGrad.addColorStop(0.5, '#FFB300');
  innerRidgeGrad.addColorStop(1, '#8A5800');
  ctx.fillStyle = innerRidgeGrad;
  ctx.beginPath();
  ctx.arc(medalCenterX, medalCenterY, medalRadius - 16, 0, Math.PI * 2);
  ctx.fill();

  // Deep inner disc
  const discGrad = ctx.createRadialGradient(medalCenterX, medalCenterY - 30, 20, medalCenterX, medalCenterY, medalRadius - 26);
  discGrad.addColorStop(0, '#FFE082');
  discGrad.addColorStop(0.4, '#FFB300');
  discGrad.addColorStop(1, '#5C3800');
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(medalCenterX, medalCenterY, medalRadius - 26, 0, Math.PI * 2);
  ctx.fill();

  // Top Crowning Flames (matching Sample Image 2)
  const flameGrad = ctx.createLinearGradient(medalCenterX, medalCenterY - medalRadius - 55, medalCenterX, medalCenterY - medalRadius + 20);
  flameGrad.addColorStop(0, '#FFFDE7');
  flameGrad.addColorStop(0.3, '#FFD54F');
  flameGrad.addColorStop(0.7, '#FF6D00');
  flameGrad.addColorStop(1, '#BF360C');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(medalCenterX - 55, medalCenterY - medalRadius + 15);
  ctx.bezierCurveTo(medalCenterX - 75, medalCenterY - medalRadius - 20, medalCenterX - 35, medalCenterY - medalRadius - 45, medalCenterX, medalCenterY - medalRadius - 60);
  ctx.bezierCurveTo(medalCenterX + 35, medalCenterY - medalRadius - 45, medalCenterX + 75, medalCenterY - medalRadius - 20, medalCenterX + 55, medalCenterY - medalRadius + 15);
  ctx.closePath();
  ctx.fill();

  // Center Bold Number (e.g. 50, 25, 75, 100)
  ctx.font = '900 108px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#261200'; // drop shadow text
  ctx.fillText(String(milestone.days), medalCenterX, medalCenterY + 34);

  ctx.fillStyle = '#FFFFFA';
  ctx.strokeStyle = '#4A2A00';
  ctx.lineWidth = 5;
  ctx.strokeText(String(milestone.days), medalCenterX, medalCenterY + 30);
  ctx.fillText(String(milestone.days), medalCenterX, medalCenterY + 30);

  // Lower Wrapped Ribbon ("DAY STREAK")
  const ribbonY = medalCenterY + 75;
  const ribbonW = 260;
  const ribbonH = 46;

  // Ribbon tail folds
  ctx.fillStyle = '#5A2A00';
  ctx.beginPath();
  ctx.moveTo(medalCenterX - ribbonW / 2 + 10, ribbonY + 10);
  ctx.lineTo(medalCenterX - ribbonW / 2 - 25, ribbonY + 35);
  ctx.lineTo(medalCenterX - ribbonW / 2 + 10, ribbonY + 35);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(medalCenterX + ribbonW / 2 - 10, ribbonY + 10);
  ctx.lineTo(medalCenterX + ribbonW / 2 + 25, ribbonY + 35);
  ctx.lineTo(medalCenterX + ribbonW / 2 - 10, ribbonY + 35);
  ctx.closePath();
  ctx.fill();

  // Main Ribbon body
  const ribGrad = ctx.createLinearGradient(medalCenterX - ribbonW / 2, ribbonY, medalCenterX + ribbonW / 2, ribbonY);
  ribGrad.addColorStop(0, '#D48800');
  ribGrad.addColorStop(0.2, '#FFAA00');
  ribGrad.addColorStop(0.5, '#FFDE59');
  ribGrad.addColorStop(0.8, '#FFAA00');
  ribGrad.addColorStop(1, '#D48800');
  ctx.fillStyle = ribGrad;
  ctx.beginPath();
  ctx.roundRect(medalCenterX - ribbonW / 2, ribbonY, ribbonW, ribbonH, 8);
  ctx.fill();
  ctx.strokeStyle = '#FFF3A8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ribbon Text
  ctx.font = '900 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#3E1C00';
  ctx.fillText('DAY STREAK', medalCenterX, ribbonY + 31);

  // Sparkle stars around medal (Sample Image 1)
  const sparkles = [
    [medalCenterX - 180, medalCenterY - 60, '#64B5F6', 14],
    [medalCenterX + 175, medalCenterY - 70, '#FFFFFF', 18],
    [medalCenterX - 170, medalCenterY + 120, '#BA68C8', 12],
    [medalCenterX + 180, medalCenterY + 50, '#FFD54F', 12],
    [medalCenterX - 90, medalCenterY - 140, '#FFFFFF', 10],
  ];
  for (const [sx, sy, color, r] of sparkles as [number, number, string, number][]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.quadraticCurveTo(sx, sy, sx + r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + r);
    ctx.quadraticCurveTo(sx, sy, sx - r, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - r);
    ctx.fill();
  }

  // 5. Badge Title (e.g. "Gold Streak Badge", matching Sample Image 1)
  ctx.textAlign = 'center';
  ctx.font = '800 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(milestone.title, size / 2, 830);

  // User acknowledgment
  if (userName) {
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(`Achieved by ${userName}`, size / 2, 875);
  }

  // 6. Brand Footer ("STREAKUP", matching Sample Image 1 CodeChef placement)
  ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillStyle = '#F59E0B';
  ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
  ctx.shadowBlur = 15;
  ctx.fillText('STREAKUP', size / 2, 960);
  ctx.shadowBlur = 0;

  return canvas;
}

/**
 * Download the generated badge card image as a PNG file.
 */
export async function downloadStreakCardImage(params: StreakCardExportParams): Promise<void> {
  const canvas = await renderStreakCardCanvas(params);
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `StreakUp_${params.milestone.days}_Day_Streak_Badge.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Share the badge card via Web Share API or fall back to copying share text.
 */
export async function shareStreakBadge(params: StreakCardExportParams): Promise<{
  shared: boolean;
  copied: boolean;
  message: string;
}> {
  const canvas = await renderStreakCardCanvas(params);
  const shareText = `🔥 I just earned the ${params.milestone.title} on StreakUp for maintaining an unbroken ${params.milestone.days}-day streak! Keep the flame burning!`;
  const shareUrl = window.location.origin;

  // Try Web Share API with image file attachment
  if (navigator.share) {
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'streak_badge.png', { type: 'image/png' })] })) {
        const file = new File([blob], `StreakUp_${params.milestone.days}d_badge.png`, { type: 'image/png' });
        await navigator.share({
          title: `StreakUp ${params.milestone.title}`,
          text: shareText,
          files: [file],
        });
        return { shared: true, copied: false, message: 'Badge shared successfully!' };
      }

      // Fallback: share text & URL
      await navigator.share({
        title: `StreakUp ${params.milestone.title}`,
        text: shareText,
        url: shareUrl,
      });
      return { shared: true, copied: false, message: 'Badge shared successfully!' };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { shared: false, copied: false, message: 'Share cancelled.' };
      }
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    return { shared: false, copied: true, message: 'Badge achievement copied to clipboard!' };
  } catch {
    return { shared: false, copied: false, message: 'Unable to share directly. You can download the card!' };
  }
}

