declare namespace Api {
  /**
   * namespace Requirement
   *
   * backend api module: "requirement"
   */
  namespace Requirement {
    /**
     * requirement status
     *
     * - 0: pending (file uploaded, not yet decomposed)
     * - 1: decomposing
     * - 2: decomposed
     * - 3: generating
     * - 4: done
     * - 5: failed
     */
    type Status = 0 | 1 | 2 | 3 | 4 | 5;

    interface Item {
      id: number;
      name: string;
      status: Status;
      features: string | null;
      testCases: string | null;
      errorMessage: string | null;
      createTime: string;
      updateTime: string;
    }

    type PageParams = Api.Common.CommonSearchParams & { name?: string };
    type PageResult = Api.Common.PaginatingQueryRecord<Item>;
  }
}
