/*
 * 数据结构第二章：作业 1/2/3 的 C 语言动手模板（不是参考答案）。
 * 使用方法：
 *   gcc -std=c11 -Wall -Wextra -pedantic homework-starter.c homework-tests.c -o ds-test
 *   ./ds-test        (Windows PowerShell 中运行 .\ds-test.exe)
 *
 * 只修改三个 TODO 函数；其它声明与测试文件保持不变。
 * 当前 TODO 是空实现，初次运行显示 FAIL 是预期行为。
 */
#include <stddef.h>
#include <stdlib.h>

typedef int ElemType;   /* 作业要求：数据元素使用 ElemType，测试时再指定具体类型 */
#define CAPACITY 64

typedef struct {
    ElemType data[CAPACITY];
    size_t length;       /* 有效元素个数，不是 CAPACITY */
} SqList;

typedef struct Node {
    ElemType data;
    struct Node *next;
} Node;

/* 习题1：L 升序（允许重复），删除全部满足 k1 < x < k2 的元素。
   前提：k1 < k2，0 <= L->length <= CAPACITY。
   注意：删除后必须更新 L->length，保证剩余元素顺序不变。
   目标：O(n) 时间、O(1) 额外空间。 */
void delete_between(SqList *L, ElemType k1, ElemType k2)
{
    /* TODO:
       1. 先说清元素是否严格落在开区间内
       2. 哪个下标负责读？哪个下标负责写？
       3. 什么时候更新有效长度？
    */
    (void)L; (void)k1; (void)k2;
}

/* 习题2：按照 A[0]、A[1]、...、A[n-1] 的顺序创建链表。
   本模板统一采用「不带头结点」单链表。
   n=0 时返回 NULL；成功时返回首个数据结点。
   每个结点由 malloc 创建；如分配失败，先释放已经创建的结点。
   想一想：要在 O(n) 时间内保持正序，需要额外维护哪个指针？ */
Node *build_list(const ElemType *A, size_t n)
{
    /* TODO: 创建结点、保存 data、链接 next、维护首尾；
       不要误用一直往最前面插的头插法。 */
    (void)A; (void)n;
    return NULL;
}

/* 习题3：只逆置 A[0..n-1]，其后元素一律不动。
   目标：O(n) 时间、O(1) 额外空间。
   n 为 0、1、奇数和偶数时都应正确。 */
void reverse_prefix(ElemType *A, size_t n)
{
    /* TODO: 两个下标从前后相向移动，只用固定个临时变量交换。 */
    (void)A; (void)n;
}
