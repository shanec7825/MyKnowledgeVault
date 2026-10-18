---
title: "The sign is stored in bit 32. The exponent can be computed from bits 24-31 by subtracting 127. The m"
lingpet_id: f3e079ac27db287d
date: 2026-10-17
tags:
  - vocabulary
  - english
source_app: "zen.exe"
---

# The sign is stored in bit 32. The exponent can be computed from bits 24-31 by subtracting 127. The m

> The sign is stored in bit 32. The exponent can be computed from bits 24-31 by subtracting 127. The mantissa (also known as significand or fraction) is stored in bits 1-23. An invisible leading bit (i.e. it is not actually stored) with value 1.0 is placed in front, then bit 23 has a value of 1/2, bit 22 has value 1/4 etc. As a result, the mantissa has a value between 1.0 and 2. If the exponent reaches -127 (binary 00000000), the leading 1 is no longer used to enable gradual underflow.

## 讲解

这段文字描述了单精度浮点数（如IEEE 754标准）的存储结构：第32位存符号，第24-31位存指数（需减127），第1-23位存尾数。尾数前隐含一个值为1的位，因此实际值在1.0到2之间。当指数为-127（全零）时，隐含位变为0以实现渐进下溢。

最值得学习的短语：
1. "be stored in"（被存储在...中）
例：The data is stored in the cloud.
2. "gradual underflow"（渐进下溢，计算机术语）
例：Gradual underflow prevents sudden numerical collapse.

## 发音

![[vocabulary/audio/lingpet-f3e079ac27db287d-01b11a9a4ee01789.wav]]

---
由 LingPet 保存。
