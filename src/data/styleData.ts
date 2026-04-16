import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ExternalLink, Camera, Palette, User, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StyleData {
  id: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  descZh: string;
  descEn: string;
  shootingGuideZh: string;
  shootingGuideEn: string;
  poseGuideZh: string;
  poseGuideEn: string;
  colorGuideZh: string;
  colorGuideEn: string;
  settingsZh: string;
  settingsEn: string;
  tutorials: { title: string; titleEn: string; url: string; platform: string }[];
  referenceImageQuery: string;
  referenceImageUrl: string;
}

export const STYLE_DATA: StyleData[] = [
  {
    id: "japanese-fresh",
    nameZh: "日系小清新", nameEn: "Japanese Fresh", emoji: "🌸",
    descZh: "柔光、低饱和、空气感、干净透亮",
    descEn: "Soft light, low saturation, airy, clean & bright",
    shootingGuideZh: "**时间**：阴天或晴天的散射光时段（避免正午直射）\n**场景**：咖啡馆、街道、公园、窗边\n**光线**：利用自然散射光或窗户漫射光，避免强硬阴影\n**镜头**：35mm或50mm定焦，大光圈F1.4-2.8制造柔和虚化\n**关键**：过曝0.3-0.7EV营造透亮感，白平衡偏暖",
    shootingGuideEn: "**Time**: Overcast or diffused light (avoid harsh noon sun)\n**Scene**: Cafés, streets, parks, window light\n**Light**: Natural diffused light, avoid hard shadows\n**Lens**: 35mm or 50mm prime, F1.4-2.8 for soft bokeh\n**Key**: Overexpose +0.3-0.7EV for airy feel, warm white balance",
    poseGuideZh: "• 自然放松，像在**生活中被抓拍**\n• 看向窗外、低头微笑、撩头发等**无意识动作**\n• 手可以拿咖啡杯、花、书等**小道具**\n• 避免刻意摆拍，**重心放松偏向一侧**\n• 肩膀微侧，**不要正对镜头**",
    poseGuideEn: "• Natural & relaxed, like **candid moments**\n• Look away, smile down, touch hair — **unconscious gestures**\n• Hold props: coffee cup, flowers, books\n• Avoid stiff poses, **shift weight to one side**\n• Slight shoulder angle, **don't face camera directly**",
    colorGuideZh: "• **降低饱和度**15-25%，保留皮肤质感\n• **提高曝光**，高光偏白营造空气感\n• 色温偏暖（+5-10），**绿色偏青**\n• 阴影加淡蓝或淡紫，**整体偏粉嫩柔和**\n• 曲线：压暗对比度，**提亮暗部**",
    colorGuideEn: "• **Lower saturation** 15-25%, preserve skin texture\n• **Boost exposure**, highlights slightly white for airy feel\n• Warm color temp (+5-10), **shift greens to teal**\n• Add light blue/purple to shadows, **overall soft & pastel**\n• Curves: reduce contrast, **lift shadows**",
    settingsZh: "光圈 F1.4-2.8 | 快门 1/200+ | ISO 100-400 | 白平衡 5800-6200K",
    settingsEn: "Aperture F1.4-2.8 | Shutter 1/200+ | ISO 100-400 | WB 5800-6200K",
    tutorials: [
      { title: "日系小清新人像调色教程", titleEn: "Japanese Fresh Portrait Color Grading", url: "https://www.xiaohongshu.com/search_result?keyword=日系小清新人像调色", platform: "小红书" },
      { title: "日系清新感怎么拍", titleEn: "How to Shoot Japanese Fresh Style", url: "https://www.douyin.com/search/日系小清新人像拍摄教程", platform: "抖音" },
      { title: "日系人像摄影完全指南", titleEn: "Complete Japanese Portrait Guide", url: "https://www.bilibili.com/search?keyword=日系人像摄影教程", platform: "B站" },
    ],
    referenceImageQuery: "日系小清新人像摄影",
  },
  {
    id: "korean-minimal",
    nameZh: "韩系ins风", nameEn: "Korean Minimal", emoji: "🧊",
    descZh: "高级灰、精致妆造、干净背景、冷调质感",
    descEn: "Muted grays, polished styling, clean background",
    shootingGuideZh: "**时间**：室内为主，窗光或均匀打光\n**场景**：极简室内、纯色墙面、咖啡厅\n**光线**：大面积柔光箱或窗户漫射光，**光比低**\n**镜头**：85mm定焦，F2-2.8，突出精致五官\n**关键**：背景极简，注重妆容服饰搭配",
    shootingGuideEn: "**Time**: Mostly indoor, window or even studio light\n**Scene**: Minimal interiors, solid walls, cafés\n**Light**: Large softbox or window diffused light, **low ratio**\n**Lens**: 85mm prime, F2-2.8, emphasize features\n**Key**: Minimal background, focus on styling",
    poseGuideZh: "• **高冷疏离感**，不需要笑\n• 手可以**托腮、撑头、轻触脸颊**\n• 坐姿为主，**身体放松但姿态优雅**\n• 眼神直视或微微偏移，**带点慵懒感**\n• 注重**手部细节**，指尖要有意识",
    poseGuideEn: "• **Cool & aloof**, no need to smile\n• Hands: **chin rest, head prop, light face touch**\n• Seated poses, **relaxed but elegant**\n• Direct or slightly off gaze, **hint of languor**\n• Focus on **hand details**, intentional fingertips",
    colorGuideZh: "• **整体偏冷灰调**，饱和度低\n• 皮肤保持**自然偏白**，不要过度磨皮\n• 高光加冷蓝，阴影加深蓝灰\n• **对比度适中**，不要太平也不要太硬\n• 去除多余的暖色，**统一冷色调**",
    colorGuideEn: "• **Overall cool gray tone**, low saturation\n• Skin stays **natural pale**, minimal smoothing\n• Cool blue highlights, deep blue-gray shadows\n• **Moderate contrast**, not flat nor harsh\n• Remove warm casts, **unify cool tones**",
    settingsZh: "光圈 F2-2.8 | 快门 1/160+ | ISO 100-200 | 白平衡 5200-5600K",
    settingsEn: "Aperture F2-2.8 | Shutter 1/160+ | ISO 100-200 | WB 5200-5600K",
    tutorials: [
      { title: "韩系高级感人像怎么拍", titleEn: "Korean Elegant Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=韩系人像摄影教程", platform: "小红书" },
      { title: "韩风ins感调色分享", titleEn: "Korean INS Style Color Grading", url: "https://www.douyin.com/search/韩系人像调色", platform: "抖音" },
    ],
    referenceImageQuery: "韩系ins风人像摄影",
  },
  {
    id: "neo-chinese",
    nameZh: "新中式", nameEn: "Neo-Chinese", emoji: "🏮",
    descZh: "汉服、国风场景、古典意境、东方美学",
    descEn: "Hanfu, traditional scenes, classical aesthetics",
    shootingGuideZh: "**时间**：清晨或傍晚金色光线\n**场景**：古建筑、园林、竹林、茶室\n**光线**：侧光或逆光制造**古典氛围**\n**镜头**：85-135mm，F2-2.8，压缩背景\n**关键**：注重服饰道具搭配，**整体意境感**",
    shootingGuideEn: "**Time**: Early morning or golden hour\n**Scene**: Traditional architecture, gardens, bamboo, tea rooms\n**Light**: Side or backlight for **classical mood**\n**Lens**: 85-135mm, F2-2.8, compress background\n**Key**: Styling & props matter, **overall atmosphere**",
    poseGuideZh: "• **端庄典雅**，体态轻盈\n• 手持扇子、灯笼等**中式道具**\n• **回眸、低头、侧身**等含蓄动作\n• 步伐轻盈，像在**漫步园林**\n• 注意**裙摆飘动**的瞬间",
    poseGuideEn: "• **Dignified & elegant**, light posture\n• Hold fans, lanterns — **Chinese props**\n• **Look back, look down, turn sideways** — subtle moves\n• Light steps, as if **strolling through gardens**\n• Capture **flowing fabric** moments",
    colorGuideZh: "• 色调偏**暖黄/红棕**，带古典质感\n• 饱和度适中，**不要过于鲜艳**\n• 绿色偏墨绿，**红色偏朱红**\n• 阴影加深棕色，**高光带暖黄**\n• 可加轻微**胶片颗粒感**",
    colorGuideEn: "• Tone towards **warm yellow/brown**, classical texture\n• Moderate saturation, **not too vivid**\n• Greens lean dark, **reds lean vermillion**\n• Deep brown shadows, **warm yellow highlights**\n• Optional light **film grain**",
    settingsZh: "光圈 F2-2.8 | 快门 1/200+ | ISO 100-400 | 白平衡 5600-6500K",
    settingsEn: "Aperture F2-2.8 | Shutter 1/200+ | ISO 100-400 | WB 5600-6500K",
    tutorials: [
      { title: "新中式人像拍摄全攻略", titleEn: "Neo-Chinese Portrait Complete Guide", url: "https://www.xiaohongshu.com/search_result?keyword=新中式人像摄影", platform: "小红书" },
      { title: "古风人像调色教程", titleEn: "Chinese Style Color Grading", url: "https://www.douyin.com/search/新中式人像拍摄", platform: "抖音" },
    ],
    referenceImageQuery: "新中式古风人像摄影",
  },
  {
    id: "boudoir",
    nameZh: "私房写真", nameEn: "Boudoir / Intimate", emoji: "🛋️",
    descZh: "室内软光、亲密感、生活化、自然放松",
    descEn: "Indoor soft light, intimate, lifestyle, relaxed",
    shootingGuideZh: "**时间**：上午窗光最佳\n**场景**：卧室、浴室、沙发、床上\n**光线**：单侧窗光+白色反光板补光\n**镜头**：35-50mm，F1.4-2，**环境人像感**\n**关键**：营造私密放松氛围，**信任感很重要**",
    shootingGuideEn: "**Time**: Morning window light is best\n**Scene**: Bedroom, bathroom, sofa, bed\n**Light**: Single side window + white reflector fill\n**Lens**: 35-50mm, F1.4-2, **environmental portrait feel**\n**Key**: Create intimate relaxed mood, **trust is essential**",
    poseGuideZh: "• **自然慵懒**，像刚起床的状态\n• 可以**躺着、侧卧、靠在窗边**\n• 手可以**整理头发、抱枕头**\n• 表情放松自然，**微闭眼或发呆**\n• 注意**身体曲线的优美弧度**",
    poseGuideEn: "• **Natural & lazy**, like just waking up\n• **Lying, side-lying, leaning on window**\n• Hands: **fix hair, hug pillow**\n• Relaxed expression, **half-closed eyes or daydreaming**\n• Emphasize **beautiful body curves**",
    colorGuideZh: "• 色调**偏暖**，营造温馨感\n• 皮肤保留**自然质感**\n• 高光柔和，**不要过曝**\n• 阴影带暖棕色\n• 整体**柔和低对比**",
    colorGuideEn: "• **Warm tones** for cozy feel\n• Preserve **natural skin texture**\n• Soft highlights, **don't overexpose**\n• Warm brown shadows\n• Overall **soft low contrast**",
    settingsZh: "光圈 F1.4-2 | 快门 1/125+ | ISO 200-800 | 白平衡 5800-6500K",
    settingsEn: "Aperture F1.4-2 | Shutter 1/125+ | ISO 200-800 | WB 5800-6500K",
    tutorials: [
      { title: "私房人像拍摄技巧", titleEn: "Boudoir Portrait Tips", url: "https://www.xiaohongshu.com/search_result?keyword=私房人像拍摄", platform: "小红书" },
    ],
    referenceImageQuery: "私房写真人像摄影",
  },
  {
    id: "natural-outdoor",
    nameZh: "自然户外风", nameEn: "Natural Outdoor", emoji: "🌿",
    descZh: "自然光、环境融合、轻松状态、真实感",
    descEn: "Natural light, environmental blend, relaxed state",
    shootingGuideZh: "**时间**：黄金时段（日出后/日落前1小时）\n**场景**：草地、花海、树林、湖边\n**光线**：逆光或侧逆光，**制造轮廓光**\n**镜头**：50-85mm，F1.8-2.8\n**关键**：人与环境融为一体，**不要脱离场景**",
    shootingGuideEn: "**Time**: Golden hour (1hr after sunrise/before sunset)\n**Scene**: Grasslands, flower fields, forests, lakeside\n**Light**: Backlight or side-back, **create rim light**\n**Lens**: 50-85mm, F1.8-2.8\n**Key**: Blend subject with environment",
    poseGuideZh: "• **走动、奔跑、转圈**等动态动作\n• 与环境互动：**摸花、拨草、看远方**\n• 表情要**开心自然**，可以大笑\n• 利用风吹头发的**瞬间**\n• 不要站在原地，**保持移动**",
    poseGuideEn: "• **Walk, run, spin** — dynamic movement\n• Interact with environment: **touch flowers, look far**\n• Expression: **happy & natural**, laugh freely\n• Capture **wind in hair** moments\n• Don't stand still, **keep moving**",
    colorGuideZh: "• **暖色调**，保留自然光的温暖\n• 绿色保持**自然饱和**\n• 肤色自然健康\n• 高光带**金黄色**\n• 对比度适中",
    colorGuideEn: "• **Warm tones**, preserve natural light warmth\n• Keep greens **naturally saturated**\n• Healthy natural skin tones\n• **Golden** highlights\n• Moderate contrast",
    settingsZh: "光圈 F1.8-2.8 | 快门 1/250+ | ISO 100-400 | 白平衡 5500-6000K",
    settingsEn: "Aperture F1.8-2.8 | Shutter 1/250+ | ISO 100-400 | WB 5500-6000K",
    tutorials: [
      { title: "户外人像拍摄指南", titleEn: "Outdoor Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=户外人像摄影技巧", platform: "小红书" },
    ],
    referenceImageQuery: "自然户外人像摄影",
  },
  {
    id: "moody-film",
    nameZh: "情绪胶片风", nameEn: "Moody Film", emoji: "📽️",
    descZh: "颗粒感、复古色调、故事氛围、情绪张力",
    descEn: "Grain, vintage tones, narrative mood, emotional tension",
    shootingGuideZh: "**时间**：阴天、傍晚、夜晚\n**场景**：老街、天台、废弃场所、雨天\n**光线**：低光环境，**利用环境光源**\n**镜头**：35-50mm，F1.4-2，还原纪实感\n**关键**：情绪先行，**故事感比技术更重要**",
    shootingGuideEn: "**Time**: Overcast, dusk, night\n**Scene**: Old streets, rooftops, abandoned places, rainy days\n**Light**: Low light, **use ambient light sources**\n**Lens**: 35-50mm, F1.4-2, documentary feel\n**Key**: Emotion first, **story matters more than technique**",
    poseGuideZh: "• **沉思、忧郁**的状态\n• 看向远方、**低头、侧脸**\n• 可以**抽烟、喝酒**等道具动作\n• 身体语言要**内敛克制**\n• 不看镜头的**抓拍感**",
    poseGuideEn: "• **Pensive, melancholic** state\n• Gaze away, **look down, profile**\n• Props: **smoking, drinking** etc.\n• Body language: **restrained & contained**\n• **Candid feel** — don't look at camera",
    colorGuideZh: "• 加**颗粒感**模拟胶片\n• 色调偏**青绿或暖黄**\n• **降低高光**，提亮暗部\n• 对比度偏低，**整体偏灰**\n• 可加**漏光效果**",
    colorGuideEn: "• Add **grain** to simulate film\n• Tone towards **teal or warm yellow**\n• **Lower highlights**, lift shadows\n• Low contrast, **overall muted**\n• Optional **light leak effects**",
    settingsZh: "光圈 F1.4-2 | 快门 1/60-1/200 | ISO 400-1600 | 白平衡 手动调整",
    settingsEn: "Aperture F1.4-2 | Shutter 1/60-1/200 | ISO 400-1600 | WB Manual adjust",
    tutorials: [
      { title: "情绪胶片人像拍摄", titleEn: "Moody Film Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=情绪胶片人像", platform: "小红书" },
      { title: "胶片感调色教程", titleEn: "Film Look Color Grading", url: "https://www.douyin.com/search/胶片感人像调色", platform: "抖音" },
    ],
    referenceImageQuery: "情绪胶片风人像摄影",
  },
  {
    id: "power-woman",
    nameZh: "大女主风", nameEn: "Power Woman", emoji: "👑",
    descZh: "强势姿态、戏剧光线、高级感、气场全开",
    descEn: "Powerful pose, dramatic lighting, commanding presence",
    shootingGuideZh: "**时间**：不限，室内打光为主\n**场景**：酒店、写字楼、大气建筑\n**光线**：硬光+伦勃朗光，**强调面部立体感**\n**镜头**：85-135mm，F2-4\n**关键**：妆容精致、服饰正式、**气场是核心**",
    shootingGuideEn: "**Time**: Any, mainly studio/indoor lighting\n**Scene**: Hotels, offices, grand architecture\n**Light**: Hard light + Rembrandt, **emphasize facial dimension**\n**Lens**: 85-135mm, F2-4\n**Key**: Polished makeup, formal attire, **presence is everything**",
    poseGuideZh: "• **挺胸抬头**，气场外放\n• 手叉腰、**抱臂、撑桌**等力量姿态\n• 眼神**直视镜头**，要有压迫感\n• 走路姿态，**步伐坚定**\n• 下巴微抬，**展现自信**",
    poseGuideEn: "• **Chest up, head high**, project power\n• Hands on hips, **arms crossed, lean on desk**\n• Eye contact **directly at camera**, intense\n• Walking pose, **confident stride**\n• Chin slightly up, **show confidence**",
    colorGuideZh: "• **高对比度**，黑白分明\n• 色调偏**冷色或中性**\n• 皮肤保持**质感但干净**\n• 暗部可以很深\n• 整体**沉稳大气**",
    colorGuideEn: "• **High contrast**, clear blacks and whites\n• **Cool or neutral** tones\n• Skin: **textured but clean**\n• Shadows can go deep\n• Overall **commanding & sophisticated**",
    settingsZh: "光圈 F2-4 | 快门 1/160+ | ISO 100-200 | 白平衡 5200-5600K",
    settingsEn: "Aperture F2-4 | Shutter 1/160+ | ISO 100-200 | WB 5200-5600K",
    tutorials: [
      { title: "大女主气场人像拍法", titleEn: "Power Woman Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=大女主人像摄影", platform: "小红书" },
    ],
    referenceImageQuery: "大女主气场人像摄影",
  },
  {
    id: "cyberpunk",
    nameZh: "赛博朋克风", nameEn: "Cyberpunk", emoji: "🌆",
    descZh: "霓虹灯光、城市夜景、科技感、未来风",
    descEn: "Neon lights, city nights, tech feel, futuristic",
    shootingGuideZh: "**时间**：夜晚\n**场景**：霓虹灯街道、商业区、地下通道\n**光线**：利用**环境霓虹灯**作为主光\n**镜头**：35-85mm，F1.4-2，吃光能力强\n**关键**：找到**彩色光源**，让光打在人脸上",
    shootingGuideEn: "**Time**: Night\n**Scene**: Neon streets, commercial areas, underpasses\n**Light**: Use **ambient neon** as key light\n**Lens**: 35-85mm, F1.4-2, good low-light performance\n**Key**: Find **colored light sources**, let light hit the face",
    poseGuideZh: "• **酷帅不羁**，带点叛逆\n• 靠墙、**蹲坐、仰视**\n• 可戴墨镜、耳机等**科技感配饰**\n• 表情冷峻或**不屑一顾**\n• 利用**烟雾、水汽**增加氛围",
    poseGuideEn: "• **Cool & rebellious**\n• Lean on walls, **squat, look up**\n• Wear sunglasses, headphones — **tech accessories**\n• Expression: cold or **contemptuous**\n• Use **smoke, vapor** for atmosphere",
    colorGuideZh: "• **青色+品红**为主色调\n• 高饱和、**高对比**\n• 暗部偏深蓝/紫\n• 高光带**霓虹色溢出**\n• 可加**色差效果**",
    colorGuideEn: "• **Teal + magenta** as main palette\n• High saturation, **high contrast**\n• Shadows lean deep blue/purple\n• Highlights with **neon color spill**\n• Optional **chromatic aberration**",
    settingsZh: "光圈 F1.4-2 | 快门 1/60-1/125 | ISO 800-3200 | 白平衡 手动",
    settingsEn: "Aperture F1.4-2 | Shutter 1/60-1/125 | ISO 800-3200 | WB Manual",
    tutorials: [
      { title: "赛博朋克夜景人像", titleEn: "Cyberpunk Night Portrait", url: "https://www.xiaohongshu.com/search_result?keyword=赛博朋克人像摄影", platform: "小红书" },
      { title: "霓虹灯人像拍摄技巧", titleEn: "Neon Portrait Techniques", url: "https://www.douyin.com/search/赛博朋克人像拍摄", platform: "抖音" },
    ],
    referenceImageQuery: "赛博朋克霓虹夜景人像",
  },
  {
    id: "classic-portrait",
    nameZh: "经典肖像", nameEn: "Classic Portrait", emoji: "🖼️",
    descZh: "标准布光、五官立体、永恒感、正式大气",
    descEn: "Standard lighting, dimensional features, timeless, formal",
    shootingGuideZh: "**时间**：室内棚拍为主\n**场景**：影棚、简洁室内\n**光线**：伦勃朗光/蝴蝶光+反光板\n**镜头**：85-135mm，F2-4\n**关键**：**布光是核心**，注重面部光影塑造",
    shootingGuideEn: "**Time**: Mostly studio\n**Scene**: Studio, clean indoor\n**Light**: Rembrandt/butterfly + reflector\n**Lens**: 85-135mm, F2-4\n**Key**: **Lighting is everything**, sculpt facial light & shadow",
    poseGuideZh: "• **正式端庄**，经典三分之二侧脸\n• 下巴微收，**眼神坚定**\n• 手自然放于膝上或身侧\n• 肩膀微侧，**制造立体感**\n• 注意**鼻影和眼神光**",
    poseGuideEn: "• **Formal & dignified**, classic 2/3 profile\n• Chin slightly tucked, **steady gaze**\n• Hands naturally on lap or sides\n• Slight shoulder angle, **create depth**\n• Watch **nose shadow & catch lights**",
    colorGuideZh: "• 自然真实的**肤色还原**\n• 对比度适中偏高\n• 背景可纯黑或**深灰**\n• 色调**中性**，不偏冷也不偏暖\n• 注重**皮肤质感细节**",
    colorGuideEn: "• Natural **skin tone reproduction**\n• Medium-high contrast\n• Background: pure black or **dark gray**\n• **Neutral** tones, not cold nor warm\n• Focus on **skin texture detail**",
    settingsZh: "光圈 F2-4 | 快门 1/160+ | ISO 100-200 | 白平衡 5500K",
    settingsEn: "Aperture F2-4 | Shutter 1/160+ | ISO 100-200 | WB 5500K",
    tutorials: [
      { title: "经典肖像布光教程", titleEn: "Classic Portrait Lighting", url: "https://www.xiaohongshu.com/search_result?keyword=经典人像布光教程", platform: "小红书" },
    ],
    referenceImageQuery: "经典肖像人像摄影布光",
  },
  {
    id: "dark-edgy",
    nameZh: "酷炫暗黑风", nameEn: "Dark & Edgy", emoji: "🖤",
    descZh: "低调暗光、冷色系、硬朗线条、神秘感",
    descEn: "Low-key dark light, cool tones, hard lines, mysterious",
    shootingGuideZh: "**时间**：夜晚或暗室\n**场景**：工业风场地、地下车库、暗巷\n**光线**：单灯硬光，**强烈明暗对比**\n**镜头**：35-85mm，F1.4-2.8\n**关键**：**阴影面积大于亮面**，制造神秘感",
    shootingGuideEn: "**Time**: Night or dark rooms\n**Scene**: Industrial spaces, parking garages, dark alleys\n**Light**: Single hard light, **strong light-dark contrast**\n**Lens**: 35-85mm, F1.4-2.8\n**Key**: **More shadow than light**, create mystery",
    poseGuideZh: "• **冷酷、孤傲**的姿态\n• 可以**低头、回望、半遮面**\n• 利用阴影**遮挡半边脸**\n• 身体语言**内收紧张**\n• 服饰以**黑色深色为主**",
    poseGuideEn: "• **Cold, aloof** posture\n• **Look down, look back, half-hidden face**\n• Use shadows to **cover half the face**\n• Body language: **closed & tense**\n• Wardrobe: **mostly black/dark**",
    colorGuideZh: "• **极低饱和度**或黑白\n• 暗部压到很深\n• 高光只保留**关键亮面**\n• 色调偏**冷蓝或冷绿**\n• 高对比度",
    colorGuideEn: "• **Very low saturation** or B&W\n• Push shadows very deep\n• Only **key highlights** remain\n• **Cool blue or green** tone\n• High contrast",
    settingsZh: "光圈 F1.4-2.8 | 快门 1/100+ | ISO 400-1600 | 白平衡 4500-5000K",
    settingsEn: "Aperture F1.4-2.8 | Shutter 1/100+ | ISO 400-1600 | WB 4500-5000K",
    tutorials: [
      { title: "暗黑风人像拍摄", titleEn: "Dark Edgy Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=暗黑风人像摄影", platform: "小红书" },
    ],
    referenceImageQuery: "暗黑风酷炫人像摄影",
  },
  {
    id: "retro-film",
    nameZh: "复古胶片风", nameEn: "Retro Film", emoji: "📷",
    descZh: "漏光、颗粒、70-90年代色调、怀旧感",
    descEn: "Light leaks, grain, 70s-90s tones, nostalgic",
    shootingGuideZh: "**时间**：午后暖光或室内\n**场景**：复古场所、老建筑、旧家具\n**光线**：自然光或暖色灯光\n**镜头**：35-50mm，模拟胶片视角\n**关键**：**道具服饰要有年代感**",
    shootingGuideEn: "**Time**: Warm afternoon or indoor\n**Scene**: Vintage locations, old buildings, retro furniture\n**Light**: Natural or warm artificial light\n**Lens**: 35-50mm, mimicking film perspective\n**Key**: **Props & wardrobe need period feel**",
    poseGuideZh: "• **随性自然**，复古生活感\n• 可以**翻杂志、听磁带、打电话**\n• 表情要**天真或淡然**\n• 不看镜头的**生活抓拍感**\n• 利用**复古道具**增强氛围",
    poseGuideEn: "• **Casual & natural**, retro lifestyle\n• **Read magazines, listen to tapes, use rotary phone**\n• Expression: **innocent or indifferent**\n• **Candid life snapshot** — don't look at camera\n• Use **vintage props** for atmosphere",
    colorGuideZh: "• **暖黄+青绿**的胶片色调\n• 加明显**颗粒感**\n• 高光偏黄，**暗部偏青**\n• 对比度偏低\n• 加**漏光和暗角**",
    colorGuideEn: "• **Warm yellow + teal** film tones\n• Add visible **grain**\n• Yellow highlights, **teal shadows**\n• Low contrast\n• Add **light leaks & vignette**",
    settingsZh: "光圈 F2-4 | 快门 1/125+ | ISO 200-800 | 白平衡 偏暖",
    settingsEn: "Aperture F2-4 | Shutter 1/125+ | ISO 200-800 | WB Warm",
    tutorials: [
      { title: "复古胶片调色教程", titleEn: "Retro Film Color Grading", url: "https://www.xiaohongshu.com/search_result?keyword=复古胶片人像调色", platform: "小红书" },
    ],
    referenceImageQuery: "复古胶片风人像摄影",
  },
  {
    id: "urban-street",
    nameZh: "城市街拍风", nameEn: "Urban Street", emoji: "🏙️",
    descZh: "街头环境、自然抓拍、纪实感、都市气息",
    descEn: "Street environment, candid shots, documentary feel",
    shootingGuideZh: "**时间**：任何时间，各有特色\n**场景**：街头、天桥、地铁、商场\n**光线**：利用**环境现有光线**\n**镜头**：28-50mm，F2-4，广角纳入环境\n**关键**：**人物与城市环境的关系**",
    shootingGuideEn: "**Time**: Any time, each has its charm\n**Scene**: Streets, overpasses, subway, malls\n**Light**: Use **available ambient light**\n**Lens**: 28-50mm, F2-4, wide to include environment\n**Key**: **Relationship between subject & urban environment**",
    poseGuideZh: "• **走路、回头、等待**等自然状态\n• 与环境互动：**过马路、靠墙、坐台阶**\n• 表情**酷帅或自然**\n• 不刻意摆拍\n• 利用**线条引导视线**",
    poseGuideEn: "• **Walking, looking back, waiting** — natural states\n• Interact: **cross street, lean on wall, sit on stairs**\n• Expression: **cool or natural**\n• Don't pose deliberately\n• Use **leading lines**",
    colorGuideZh: "• **高对比纪实感**\n• 色调可冷可暖\n• 保留**环境真实色彩**\n• 适当加**锐化**\n• 可做黑白处理",
    colorGuideEn: "• **High contrast documentary feel**\n• Tone can be warm or cool\n• Preserve **real environmental colors**\n• Moderate **sharpening**\n• B&W is an option",
    settingsZh: "光圈 F2-5.6 | 快门 1/250+ | ISO auto | 白平衡 自动",
    settingsEn: "Aperture F2-5.6 | Shutter 1/250+ | ISO auto | WB Auto",
    tutorials: [
      { title: "街拍人像摄影教程", titleEn: "Street Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=城市街拍人像", platform: "小红书" },
    ],
    referenceImageQuery: "城市街拍人像摄影",
  },
  {
    id: "minimalist",
    nameZh: "极简留白风", nameEn: "Minimalist", emoji: "⬜",
    descZh: "大面积负空间、简洁背景、主体突出",
    descEn: "Large negative space, clean background, subject focus",
    shootingGuideZh: "**时间**：任意，光线要**干净均匀**\n**场景**：纯色墙面、天空、空旷场地\n**光线**：柔和均匀，**避免杂乱阴影**\n**镜头**：50-135mm，F2-4\n**关键**：**少即是多**，画面元素越少越好",
    shootingGuideEn: "**Time**: Any, light must be **clean & even**\n**Scene**: Solid walls, sky, open spaces\n**Light**: Soft & even, **avoid messy shadows**\n**Lens**: 50-135mm, F2-4\n**Key**: **Less is more**, fewer elements is better",
    poseGuideZh: "• **简单干净**的姿态\n• 一个动作、一个表情\n• **留大量空白**给画面呼吸\n• 人物占画面比例可以很小\n• 注重**轮廓线条**",
    poseGuideEn: "• **Simple & clean** poses\n• One gesture, one expression\n• **Leave ample white space** for breathing room\n• Subject can be small in frame\n• Focus on **silhouette & lines**",
    colorGuideZh: "• **低饱和**，干净色彩\n• 最多**2-3种颜色**\n• 背景尽量**纯净**\n• 对比度适中\n• 整体**安静克制**",
    colorGuideEn: "• **Low saturation**, clean colors\n• Maximum **2-3 colors**\n• Background as **pure** as possible\n• Moderate contrast\n• Overall **quiet & restrained**",
    settingsZh: "光圈 F2-4 | 快门 根据光线 | ISO 100-400 | 白平衡 5500K",
    settingsEn: "Aperture F2-4 | Shutter varies | ISO 100-400 | WB 5500K",
    tutorials: [
      { title: "极简人像摄影教程", titleEn: "Minimalist Portrait Guide", url: "https://www.xiaohongshu.com/search_result?keyword=极简人像摄影", platform: "小红书" },
    ],
    referenceImageQuery: "极简留白人像摄影",
  },
  {
    id: "high-fashion",
    nameZh: "高奢时尚风", nameEn: "High Fashion", emoji: "💎",
    descZh: "硬光、高对比、杂志质感、奢华感",
    descEn: "Hard light, high contrast, magazine quality, luxury",
    shootingGuideZh: "**时间**：棚拍为主\n**场景**：影棚、高端酒店、建筑\n**光线**：硬光+蜂巢/旗板控光\n**镜头**：85-200mm，F2.8-5.6\n**关键**：**妆容服饰是灵魂**，每个细节都要完美",
    shootingGuideEn: "**Time**: Mostly studio\n**Scene**: Studio, luxury hotels, architecture\n**Light**: Hard light + grid/flags for control\n**Lens**: 85-200mm, F2.8-5.6\n**Key**: **Styling is the soul**, every detail must be perfect",
    poseGuideZh: "• **夸张戏剧化**的姿态\n• 手部造型要**刻意设计**\n• 表情**高冷或戏剧化**\n• 可以**大幅度动作**\n• 参考**时尚杂志**造型",
    poseGuideEn: "• **Exaggerated dramatic** poses\n• Hand shapes must be **deliberately designed**\n• Expression: **cold or theatrical**\n• Can use **big movements**\n• Reference **fashion magazines**",
    colorGuideZh: "• **高对比高饱和**或极致低饱和\n• 皮肤保留**高质感**\n• 色彩要**统一大胆**\n• 暗部可以很实\n• 后期**精修精细**",
    colorGuideEn: "• **High contrast + saturation** or extremely desaturated\n• Skin: **high texture quality**\n• Colors: **unified & bold**\n• Shadows can be solid\n• Post: **detailed retouching**",
    settingsZh: "光圈 F2.8-5.6 | 快门 1/200+ | ISO 100 | 白平衡 精准校准",
    settingsEn: "Aperture F2.8-5.6 | Shutter 1/200+ | ISO 100 | WB Precisely calibrated",
    tutorials: [
      { title: "时尚大片拍摄教程", titleEn: "High Fashion Shoot Guide", url: "https://www.xiaohongshu.com/search_result?keyword=时尚大片人像摄影", platform: "小红书" },
    ],
    referenceImageQuery: "高奢时尚人像摄影杂志",
  },
];

// Map style names to IDs for lookup from critique
export const STYLE_NAME_MAP: Record<string, string> = {};
STYLE_DATA.forEach((s) => {
  STYLE_NAME_MAP[s.nameZh] = s.id;
  STYLE_NAME_MAP[s.nameEn.toLowerCase()] = s.id;
  // Also map partial names
  STYLE_NAME_MAP[s.nameZh.replace(/风$/, "")] = s.id;
});
