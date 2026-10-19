/*
 * 与 homework-starter.c 一起编译。
 * 此文件只提供输入、期待结果和自动对比，不包含三题算法答案。
 * gcc -std=c11 -Wall -Wextra -pedantic homework-starter.c homework-tests.c -o ds-test
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
typedef int ElemType;
#define CAPACITY 64
typedef struct { ElemType data[CAPACITY]; size_t length; } SqList;
typedef struct Node { ElemType data; struct Node *next; } Node;
void delete_between(SqList *L, ElemType k1, ElemType k2);
Node *build_list(const ElemType *A, size_t n);
void reverse_prefix(ElemType *A, size_t n);

static int passed = 0, failed = 0;

static void check_array(const char *name, const ElemType *got, size_t gotlen,
                        const ElemType *expected, size_t wantlen)
{
    int ok = gotlen == wantlen;
    if (ok && wantlen > 0) ok = memcmp(got, expected, wantlen * sizeof(ElemType)) == 0;
    if (ok) { printf("PASS %s\n",name); passed++; }
    else {
        size_t i;
        printf("FAIL %s (got len=%zu, expected len=%zu)\n",name,gotlen,wantlen);
        printf("     got:"); for (i=0;i<gotlen && i<CAPACITY;i++) printf(" %d",got[i]); puts("");
        printf("expected:"); for (i=0;i<wantlen;i++) printf(" %d",expected[i]); puts("");
        failed++;
    }
}
static void check_list(const char *name, Node *head,
                       const ElemType *expected, size_t n)
{
    size_t i=0; int ok=1;
    Node *p=head;
    while (p && i<n) { if (p->data!=expected[i]) ok=0; i++; p=p->next; }
    if (i!=n || p!=NULL) ok=0;
    if (ok) { printf("PASS %s\n",name); passed++; }
    else { printf("FAIL %s (wrong order/length, or returned NULL)\n",name); failed++; }
    /* 正常无环链表在这里被释放；循环链接属于错误实现。 */
    p=head; i=0;
    while (p && i<1000) { Node *next=p->next; free(p); p=next; i++; }
}
static void test_delete(void)
{
    SqList a={{1,3,3,5,6,8,10,10,13},9};
    const ElemType ea[]={1,3,3,10,10,13};
    delete_between(&a,3,10); check_array("习题1 / 重复边界",a.data,a.length,ea,6);
    SqList b={{1,2,3},3};
    const ElemType eb[]={1,2,3};
    delete_between(&b,5,7); check_array("习题1 / 无元素可删",b.data,b.length,eb,3);
    SqList c={{5,6,7},3};
    delete_between(&c,1,9); check_array("习题1 / 全删",c.data,c.length,NULL,0);
    SqList d={{0},0};
    delete_between(&d,1,9); check_array("习题1 / 空表",d.data,d.length,NULL,0);
    SqList e={{2,3,4,5,6},5};
    const ElemType ee[]={2,3,6};
    delete_between(&e,3,6); check_array("习题1 / 两端严格不删",e.data,e.length,ee,3);
}
static void test_build(void)
{
    const ElemType a[]={8,3,8,1};
    Node *la=build_list(a,4); check_list("习题2 / 正序+重复",la,a,4);
    Node *lb=build_list(NULL,0); check_list("习题2 / 空数组",lb,NULL,0);
    const ElemType c[]={42};
    Node *lc=build_list(c,1); check_list("习题2 / 单结点",lc,c,1);
}
static void test_reverse(void)
{
    ElemType a[]={2,7,1,8,2,8,99,100};
    const ElemType ea[]={8,2,8,1,7,2,99,100};
    reverse_prefix(a,6); check_array("习题3 / 前6项+保留后缀",a,8,ea,8);
    ElemType b[]={3,5,7,9,11,99};
    const ElemType eb[]={11,9,7,5,3,99};
    reverse_prefix(b,5); check_array("习题3 / 奇数+中点",b,6,eb,6);
    ElemType c[]={3,4};
    const ElemType ec[]={3,4};
    reverse_prefix(c,0); check_array("习题3 / n=0",c,2,ec,2);
    reverse_prefix(c,1); check_array("习题3 / n=1",c,2,ec,2);
}
int main(void)
{
    test_delete(); test_build(); test_reverse();
    printf("\n合计 PASS %d / FAIL %d\n",passed,failed);
    return failed ? EXIT_FAILURE : EXIT_SUCCESS;
}
